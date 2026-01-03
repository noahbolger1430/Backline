"""
Tour Generator Service

Generates optimized tour schedules for bands by analyzing:
- Band and member availability
- Geographic routing and travel distances
- Venue and event opportunities
- Genre matching and venue compatibility
- Event recommendation scores
- User-configurable algorithm weights
"""

from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, field
import logging

from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Band,
    BandAvailability,
    BandMember,
    BandMemberAvailability,
    Event,
    EventApplication,
    Venue,
    VenueAvailability,
    BandEvent,
    GigView,
)
from app.models.availability import AvailabilityStatus
from app.models.event import EventStatus
from app.models.event_application import ApplicationStatus
from app.models.venue_favorite import VenueFavorite
from app.services.availability_service import AvailabilityService
from app.services.recommendation_service import RecommendationService
from app.services.tour_generator_geocoding_utils import (
    AddressParser,
    GeocodingService,
    calculate_distance,
    build_location_string,
    estimate_distance_from_location,
    estimate_distance_heuristic,
    calculate_distance_between_venues,
    EARTH_RADIUS_KM,
    DEFAULT_UNKNOWN_DISTANCE_KM,
    DEFAULT_SAME_CITY_DISTANCE_KM,
    DEFAULT_SAME_STATE_DISTANCE_KM,
    DEFAULT_DIFFERENT_STATE_DISTANCE_KM,
)
from app.services.tour_generator_date_utils import (
    is_weekend,
    calculate_weekend_penalty,
    find_nearest_weekend,
    WEEKEND_DAYS,
    DEFAULT_WEIGHT_WEEKEND_BONUS,
)


logger = logging.getLogger(__name__)


@dataclass
class AlgorithmWeightsConfig:
    """
    Configuration for algorithm weights provided by the user.
    
    All values should be between 0.0 and 1.0 and represent relative importance.
    """
    
    genre_match_weight: float = 0.25
    capacity_match_weight: float = 0.15
    distance_weight: float = 0.20
    weekend_preference_weight: float = 0.15
    recommendation_score_weight: float = 0.25


@dataclass
class TourStop:
    """
    Represents a potential tour stop with scoring information.
    """
    
    date: date
    venue: Venue
    event: Optional[Event]
    distance_from_previous: float
    travel_days_needed: int
    score: float
    score_breakdown: Dict[str, float]
    is_existing_event: bool
    availability_status: str
    reasoning: List[str]
    distance_from_home: float = 0.0
    recommendation_score: Optional[float] = None
    recommendation_reasons: Optional[List[Dict]] = None
    is_primary_venue_option: bool = True


@dataclass
class TourGeneratorParams:
    """
    Parameters for tour generation.
    """
    
    band_id: int
    start_date: date
    end_date: date
    tour_radius_km: float
    starting_location: Optional[str] = None
    ending_location: Optional[str] = None
    min_days_between_shows: int = 0
    max_days_between_shows: int = 7
    max_drive_hours_per_day: float = 8.0
    preferred_genres: Optional[List[str]] = None
    preferred_venue_capacity_min: Optional[int] = None
    preferred_venue_capacity_max: Optional[int] = None
    prioritize_weekends: bool = True
    avoid_venue_ids: Optional[List[int]] = None
    algorithm_weights: Optional[AlgorithmWeightsConfig] = None


@dataclass
class TourGeneratorResult:
    """
    Result of tour generation containing recommended events and venues.
    """
    
    recommended_events: List[Dict]
    recommended_venues: List[Dict]
    tour_stops: List[TourStop]
    total_distance_km: float
    total_travel_days: int
    total_show_days: int
    tour_efficiency_score: float
    availability_conflicts: List[Dict]
    routing_warnings: List[str]


# Utility classes moved to tour_generator_geocoding_utils.py and tour_generator_date_utils.py
# AddressParser, GeocodingService, and date utilities are now imported

class TourGeneratorService:
    """
    Service for generating optimized band tours.
    """
    
    AVERAGE_DRIVING_SPEED_KMH = 80.0
    
    DEFAULT_WEIGHT_RECOMMENDATION_SYSTEM = 35.0
    DEFAULT_WEIGHT_GENRE_MATCH = 15.0
    DEFAULT_WEIGHT_VENUE_SIZE_MATCH = 15.0
    # DEFAULT_WEIGHT_WEEKEND_BONUS moved to tour_generator_date_utils.py
    DEFAULT_WEIGHT_TRAVEL_EFFICIENCY = 20.0
    DEFAULT_WEIGHT_VENUE_QUALITY = 15.0
    DEFAULT_WEIGHT_EXISTING_EVENT = 20.0
    DEFAULT_WEIGHT_ROUTING_CONTINUITY = 25.0
    DEFAULT_WEIGHT_AVAILABILITY = 40.0
    DEFAULT_WEIGHT_FAVORITED_VENUE = 10.0
    DEFAULT_WEIGHT_VENUE_DIVERSITY = 20.0
    DEFAULT_WEIGHT_VENUE_BASE = 20.0  # Base score for direct venue bookings (increased to help venues without events)
    DEFAULT_WEIGHT_ACTIVE_VENUE = 10.0  # Bonus for venues that have hosted events
    
    PENALTY_LONG_DRIVE = -15.0
    PENALTY_BACKTRACKING = -20.0
    PENALTY_GAP_TOO_LONG = -10.0
    PENALTY_UNAVAILABLE = -100.0
    PENALTY_DUPLICATE_VENUE = -50.0

    @classmethod
    def _get_scaled_weights(
        cls,
        algorithm_weights: Optional[AlgorithmWeightsConfig]
    ) -> Dict[str, float]:
        """
        Calculate scaled weights based on user configuration.
        
        Takes the user-provided weights (0.0-1.0) and scales them to the
        internal scoring system while maintaining relative proportions.
        
        Args:
            algorithm_weights: User-provided weight configuration
            
        Returns:
            Dictionary of scaled weight values
        """
        if algorithm_weights is None:
            return {
                'recommendation_system': cls.DEFAULT_WEIGHT_RECOMMENDATION_SYSTEM,
                'genre_match': cls.DEFAULT_WEIGHT_GENRE_MATCH,
                'venue_size_match': cls.DEFAULT_WEIGHT_VENUE_SIZE_MATCH,
                'weekend_bonus': DEFAULT_WEIGHT_WEEKEND_BONUS,
                'travel_efficiency': cls.DEFAULT_WEIGHT_TRAVEL_EFFICIENCY,
                'venue_quality': cls.DEFAULT_WEIGHT_VENUE_QUALITY,
                'existing_event': cls.DEFAULT_WEIGHT_EXISTING_EVENT,
                'routing_continuity': cls.DEFAULT_WEIGHT_ROUTING_CONTINUITY,
                'availability': cls.DEFAULT_WEIGHT_AVAILABILITY,
                'favorited_venue': cls.DEFAULT_WEIGHT_FAVORITED_VENUE,
                'venue_diversity': cls.DEFAULT_WEIGHT_VENUE_DIVERSITY,
                'venue_base': cls.DEFAULT_WEIGHT_VENUE_BASE,
                'active_venue': cls.DEFAULT_WEIGHT_ACTIVE_VENUE,
            }
        
        base_scale = 100.0
        
        # Scale weekend bonus more aggressively to ensure it has impact
        weekend_scale = algorithm_weights.weekend_preference_weight * base_scale * 0.30
        
        return {
            'recommendation_system': algorithm_weights.recommendation_score_weight * base_scale * 0.35,
            'genre_match': algorithm_weights.genre_match_weight * base_scale * 0.15,
            'venue_size_match': algorithm_weights.capacity_match_weight * base_scale * 0.15,
            'weekend_bonus': weekend_scale,  # Increased impact
            'travel_efficiency': algorithm_weights.distance_weight * base_scale * 0.20,
            'venue_quality': cls.DEFAULT_WEIGHT_VENUE_QUALITY,
            'existing_event': cls.DEFAULT_WEIGHT_EXISTING_EVENT,
            'routing_continuity': algorithm_weights.distance_weight * base_scale * 0.25,
            'availability': cls.DEFAULT_WEIGHT_AVAILABILITY,
            'favorited_venue': cls.DEFAULT_WEIGHT_FAVORITED_VENUE,
            'venue_diversity': cls.DEFAULT_WEIGHT_VENUE_DIVERSITY,
            'venue_base': cls.DEFAULT_WEIGHT_VENUE_BASE,
            'active_venue': cls.DEFAULT_WEIGHT_ACTIVE_VENUE,
        }

    # Weekend utility methods moved to tour_generator_date_utils.py

    @classmethod
    def generate_tour(
        cls,
        db: Session,
        params: TourGeneratorParams
    ) -> TourGeneratorResult:
        """
        Generate an optimized tour schedule for a band.
        
        Args:
            db: Database session
            params: Tour generation parameters including optional algorithm weights
            
        Returns:
            TourGeneratorResult containing recommended events and venues
        """
        band = db.query(Band).filter(Band.id == params.band_id).first()
        if not band:
            return cls._empty_result("Band not found")
        
        scaled_weights = cls._get_scaled_weights(params.algorithm_weights)
        
        availability_map = cls._get_band_availability_map(
            db, band, params.start_date, params.end_date
        )
        
        available_dates = cls._find_available_dates(
            availability_map, params.start_date, params.end_date
        )
        
        if not available_dates:
            return cls._empty_result("No available dates found in tour period")
        
        matching_events = cls._find_matching_events(
            db, band, params, available_dates
        )
        
        event_recommendations = cls._get_event_recommendation_scores(
            db, band, matching_events
        )
        
        potential_venues = cls._find_potential_venues(
            db, band, params
        )
        
        tour_stops = cls._generate_tour_stops(
            db, band, params, matching_events, potential_venues, 
            available_dates, availability_map, event_recommendations,
            scaled_weights
        )
        
        optimized_tour = cls._optimize_routing_with_diversity(
            tour_stops, params, availability_map, scaled_weights, db, band, potential_venues
        )
        
        total_distance = sum(stop.distance_from_previous for stop in optimized_tour)
        total_travel_days = sum(stop.travel_days_needed for stop in optimized_tour)
        total_show_days = len(optimized_tour)
        
        efficiency_score = cls._calculate_tour_efficiency(
            optimized_tour, total_distance, total_travel_days, total_show_days
        )
        
        recommended_events = cls._format_event_recommendations(
            optimized_tour, params
        )
        
        recommended_venues = cls._format_venue_recommendations(
            optimized_tour, params
        )
        
        conflicts = cls._identify_availability_conflicts(
            availability_map, optimized_tour
        )
        
        warnings = cls._generate_routing_warnings(
            optimized_tour, total_distance
        )
        
        return TourGeneratorResult(
            recommended_events=recommended_events,
            recommended_venues=recommended_venues,
            tour_stops=optimized_tour,
            total_distance_km=total_distance,
            total_travel_days=total_travel_days,
            total_show_days=total_show_days,
            tour_efficiency_score=efficiency_score,
            availability_conflicts=conflicts,
            routing_warnings=warnings
        )

    @classmethod
    def _get_band_availability_map(
        cls,
        db: Session,
        band: Band,
        start_date: date,
        end_date: date
    ) -> Dict[date, Dict]:
        """
        Get band availability for each date in the range.
        
        Returns:
            Dict mapping date to availability details
        """
        availability_map = {}
        current_date = start_date
        
        while current_date <= end_date:
            is_available, member_details = AvailabilityService.get_band_effective_availability(
                db, band, current_date
            )
            
            band_block = (
                db.query(BandAvailability)
                .filter(
                    BandAvailability.band_id == band.id,
                    BandAvailability.date == current_date
                )
                .first()
            )
            
            availability_map[current_date] = {
                'is_available': is_available,
                'has_band_block': band_block is not None,
                'band_event_id': band_block.band_event_id if band_block else None,
                'member_details': member_details,
                'unavailable_count': sum(
                    1 for m in member_details 
                    if m.status.value == AvailabilityStatus.UNAVAILABLE.value
                ),
                'tentative_count': sum(
                    1 for m in member_details 
                    if m.status.value == AvailabilityStatus.TENTATIVE.value
                )
            }
            
            current_date += timedelta(days=1)
        
        return availability_map

    @classmethod
    def _find_available_dates(
        cls,
        availability_map: Dict[date, Dict],
        start_date: date,
        end_date: date
    ) -> List[date]:
        """
        Find all dates where the band is available.
        
        Returns:
            List of available dates
        """
        available_dates = []
        
        for check_date in availability_map.keys():
            if availability_map[check_date]['is_available']:
                available_dates.append(check_date)
        
        return sorted(available_dates)

    @classmethod
    def _find_matching_events(
        cls,
        db: Session,
        band: Band,
        params: TourGeneratorParams,
        available_dates: List[date]
    ) -> List[Event]:
        """
        Find existing events that match tour criteria.
        
        Returns:
            List of matching events
        """
        query = db.query(Event).join(Venue)
        
        query = query.filter(
            Event.event_date.in_(available_dates),
            Event.status == EventStatus.PENDING.value,
            Event.is_open_for_applications == True
        )
        
        if params.preferred_venue_capacity_min:
            query = query.filter(
                Venue.capacity >= params.preferred_venue_capacity_min
            )
        if params.preferred_venue_capacity_max:
            query = query.filter(
                Venue.capacity <= params.preferred_venue_capacity_max
            )
        
        if params.avoid_venue_ids:
            query = query.filter(
                ~Venue.id.in_(params.avoid_venue_ids)
            )
        
        # NOTE: Genre matching is now handled as a scoring factor, not a filter
        # This ensures events still appear even without perfect genre matches
        # All events that meet other criteria are included, then scored by genre match
        
        events = query.options(joinedload(Event.venue)).all()
        
        applied_event_ids = {
            app.event_id for app in 
            db.query(EventApplication)
            .filter(EventApplication.band_id == band.id)
            .all()
        }
        
        booked_event_ids = {
            be.event_id for be in
            db.query(BandEvent)
            .filter(BandEvent.band_id == band.id)
            .all()
        }
        
        excluded_ids = applied_event_ids | booked_event_ids
        
        return [e for e in events if e.id not in excluded_ids]

    @classmethod
    def _get_event_recommendation_scores(
        cls,
        db: Session,
        band: Band,
        events: List[Event]
    ) -> Dict[int, Tuple[float, List[Dict]]]:
        """
        Get recommendation scores for events using the recommendation service.
        
        Returns:
            Dict mapping event_id to (score, reasons)
        """
        recommendations = {}
        
        applications = (
            db.query(EventApplication)
            .filter(EventApplication.band_id == band.id)
            .all()
        )
        applied_event_ids = {app.event_id: app for app in applications}
        
        accepted_venue_ids = set()
        rejected_venue_ids = set()
        for app in applications:
            event = db.query(Event).filter(Event.id == app.event_id).first()
            if event:
                if app.status == ApplicationStatus.ACCEPTED.value:
                    accepted_venue_ids.add(event.venue_id)
                elif app.status == ApplicationStatus.REJECTED.value:
                    rejected_venue_ids.add(event.venue_id)
        
        booked_events = (
            db.query(BandEvent)
            .join(Event)
            .filter(
                BandEvent.band_id == band.id,
                Event.event_date >= date.today(),
            )
            .all()
        )
        booked_dates = {be.event.event_date for be in booked_events if be.event}
        
        application_counts = dict(
            db.query(EventApplication.event_id, func.count(EventApplication.id))
            .group_by(EventApplication.event_id)
            .all()
        )
        
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}
        
        similar_bands_data = RecommendationService._get_similar_bands_data(
            db, band, accepted_venue_ids
        )
        
        for event in events:
            score, reasons = RecommendationService._score_event_for_band(
                db=db,
                event=event,
                band=band,
                accepted_venue_ids=accepted_venue_ids,
                rejected_venue_ids=rejected_venue_ids,
                booked_dates=booked_dates,
                application_count=application_counts.get(event.id, 0),
                similar_bands_data=similar_bands_data,
                favorited_venue_ids=favorited_venue_ids,
            )
            
            reasons_dict = [
                {
                    'type': r.type,
                    'label': r.label,
                    'score': r.score
                }
                for r in reasons
            ]
            
            recommendations[event.id] = (score, reasons_dict)
        
        return recommendations

    @classmethod
    def _find_potential_venues(
        cls,
        db: Session,
        band: Band,
        params: TourGeneratorParams
    ) -> List[Venue]:
        """
        Find venues that could host the band, including venues without events.
        
        Venues are scored based on various factors, with active venues (those
        that have hosted events) receiving a bonus. Venues without events are
        still included but with lower priority.
        
        Genre matching only applies to venues with event history - venues without
        events are not penalized for lack of genre information.
        
        Returns:
            List of potential venues sorted by relevance
        """
        query = db.query(Venue)
        
        if params.preferred_venue_capacity_min:
            query = query.filter(
                Venue.capacity >= params.preferred_venue_capacity_min
            )
        if params.preferred_venue_capacity_max:
            query = query.filter(
                Venue.capacity <= params.preferred_venue_capacity_max
            )
        
        if params.avoid_venue_ids:
            query = query.filter(
                ~Venue.id.in_(params.avoid_venue_ids)
            )
        
        venues = query.all()
        
        previous_venues = (
            db.query(Venue.id)
            .join(Event)
            .join(BandEvent)
            .filter(BandEvent.band_id == band.id)
            .distinct()
            .all()
        )
        previous_venue_ids = {v[0] for v in previous_venues}
        
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}
        
        # Get venues that have hosted events (active venues)
        active_venue_query = db.query(Event.venue_id).distinct().all()
        active_venue_ids = {v[0] for v in active_venue_query}
        
        # Check if preferred genres are specified
        has_genre_preference = params.preferred_genres and len(params.preferred_genres) > 0
        
        scored_venues = []
        for venue in venues:
            score = 0.0
            
            # Base score for all venues - ensures venues without events still appear
            # Higher base score when genre preferences are specified to ensure
            # new venues aren't excluded due to lack of genre data
            if has_genre_preference:
                score += 25.0  # Significantly increased to ensure new venues appear
            else:
                score += 15.0
            
            if venue.id in previous_venue_ids:
                score += 20.0
            
            if venue.id in favorited_venue_ids:
                score += 15.0
            
            # Bonus for active venues
            if venue.id in active_venue_ids:
                score += 10.0
                
                # Genre matching ONLY for venues with event history
                # This ensures new venues aren't penalized for lack of genre data
                if band.genre and venue.events and has_genre_preference:
                    venue_genres = set()
                    for event in venue.events:
                        if event.genre_tags:
                            venue_genres.update(
                                g.strip().lower() 
                                for g in event.genre_tags.split(',')
                            )
                    
                    # Check against preferred genres (not band genre)
                    preferred_genres_lower = set(g.strip().lower() for g in params.preferred_genres)
                    
                    if venue_genres & preferred_genres_lower:
                        # Genre match bonus for venues with matching event history
                        # Keep it relatively small so genre doesn't dominate other factors
                        score += 10.0
                    else:
                        # Very small penalty for venues with non-matching genres
                        # (they have events, but in different genres)
                        # Penalty is small to ensure venues still appear
                        score -= 2.0
            else:
                # New venues without events get a significant bonus score
                # When genre preferences are specified, give them a much higher bonus
                # to ensure they still appear even without genre data
                if has_genre_preference:
                    # Much higher bonus when genres are specified to ensure they're not excluded
                    # This compensates for lack of genre matching data
                    score += 25.0  # Significantly increased to ensure they outscore non-matching active venues
                else:
                    score += 15.0  # Good base score even without genre preferences
            
            # Location score (minimal, just to ensure some differentiation)
            location_score = 5.0
            score += location_score
            
            scored_venues.append((venue, score))
        
        scored_venues.sort(key=lambda x: x[1], reverse=True)
        return [v[0] for v in scored_venues[:100]]

    @classmethod
    def _generate_tour_stops(
        cls,
        db: Session,
        band: Band,
        params: TourGeneratorParams,
        events: List[Event],
        venues: List[Venue],
        available_dates: List[date],
        availability_map: Dict[date, Dict],
        event_recommendations: Dict[int, Tuple[float, List[Dict]]],
        scaled_weights: Dict[str, float]
    ) -> List[TourStop]:
        """
        Generate potential tour stops from events and venues with venue diversity.
        
        Events (venues with open applications) are prioritized over direct venue
        bookings. Venues without events are included as direct booking opportunities
        but with lower scores to maintain proper priority ordering.
        
        Returns:
            List of scored tour stops with diverse venue options
        """
        tour_stops = []
        
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}
        
        # Track which venues have been suggested to promote diversity
        suggested_venue_ids = set()
        venue_suggestion_counts = {}
        
        # Get active venue IDs (venues that have hosted events)
        active_venue_query = db.query(Event.venue_id).distinct().all()
        active_venue_ids = {v[0] for v in active_venue_query}
        
        # Process existing events
        for event in events:
            if event.event_date not in available_dates:
                continue
            
            availability = availability_map.get(event.event_date, {})
            
            rec_score, rec_reasons = event_recommendations.get(event.id, (0.0, []))
            
            score = 0.0
            score_breakdown = {}
            reasoning = []
            
            if rec_score > 0:
                normalized_rec_score = min(
                    scaled_weights['recommendation_system'], 
                    (rec_score / 100) * scaled_weights['recommendation_system']
                )
                score += normalized_rec_score
                score_breakdown['recommendation_system'] = normalized_rec_score
                reasoning.append('High recommendation score')
                
                top_reasons = sorted(rec_reasons, key=lambda x: x['score'], reverse=True)[:2]
                for reason in top_reasons:
                    reasoning.append(reason['label'])
            
            score += scaled_weights.get('existing_event', cls.DEFAULT_WEIGHT_EXISTING_EVENT)
            score_breakdown['existing_event'] = scaled_weights.get('existing_event', cls.DEFAULT_WEIGHT_EXISTING_EVENT)
            reasoning.append('Existing event open for applications')
            
            if event.venue and event.venue.id in favorited_venue_ids:
                score += scaled_weights['favorited_venue']
                score_breakdown['favorited_venue'] = scaled_weights['favorited_venue']
                reasoning.append('Favorited venue')
            
            # Weekend bonus/penalty for events
            if params.prioritize_weekends:
                if is_weekend(event.event_date):
                    score += scaled_weights['weekend_bonus']
                    score_breakdown['weekend'] = scaled_weights['weekend_bonus']
                    reasoning.append('Weekend show (Fri/Sat)')
                else:
                    # Apply penalty for weekdays/Sundays when weekends are prioritized
                    weekday_penalty = -scaled_weights.get('weekend_bonus', DEFAULT_WEIGHT_WEEKEND_BONUS) * 0.6
                    score += weekday_penalty
                    score_breakdown['weekday_penalty'] = weekday_penalty
                    # Don't add to reasoning to avoid negative messaging
            
            if event.venue and event.venue.capacity:
                if params.preferred_venue_capacity_min and params.preferred_venue_capacity_max:
                    if (params.preferred_venue_capacity_min <= event.venue.capacity <= 
                        params.preferred_venue_capacity_max):
                        score += scaled_weights['venue_size_match']
                        score_breakdown['venue_size'] = scaled_weights['venue_size_match']
                        reasoning.append('Venue size matches preferences')
            
            # Genre matching as a scoring factor (not a filter)
            # Events without genre matches still appear, just with lower scores
            if params.preferred_genres and event.genre_tags:
                event_genres = set(g.strip().lower() for g in event.genre_tags.split(','))
                preferred_genres_lower = set(g.strip().lower() for g in params.preferred_genres)
                
                if event_genres & preferred_genres_lower:
                    # Genre match bonus - but keep it relatively small
                    genre_bonus = scaled_weights.get('genre_match', cls.DEFAULT_WEIGHT_GENRE_MATCH) * 0.5
                    score += genre_bonus
                    score_breakdown['genre_match'] = genre_bonus
                    reasoning.append('Genre matches preferences')
                else:
                    # Small penalty for non-matching genres, but event still included
                    genre_penalty = scaled_weights.get('genre_match', cls.DEFAULT_WEIGHT_GENRE_MATCH) * -0.2
                    score += genre_penalty
                    score_breakdown['genre_mismatch'] = genre_penalty
                    # Don't add to reasoning to avoid negative messaging
            
            if availability.get('is_available'):
                score += scaled_weights['availability']
                score_breakdown['availability'] = scaled_weights['availability']
                availability_status = 'available'
            elif availability.get('tentative_count', 0) > 0:
                score += scaled_weights['availability'] * 0.5
                score_breakdown['availability'] = scaled_weights['availability'] * 0.5
                availability_status = 'tentative'
                reasoning.append(f"{availability.get('tentative_count', 0)} members tentative")
            else:
                score += cls.PENALTY_UNAVAILABLE
                score_breakdown['availability'] = cls.PENALTY_UNAVAILABLE
                availability_status = 'unavailable'
                reasoning.append('Band unavailable on this date')
            
            tour_stops.append(TourStop(
                date=event.event_date,
                venue=event.venue,
                event=event,
                distance_from_previous=0.0,
                distance_from_home=0.0,
                travel_days_needed=0,
                score=score,
                score_breakdown=score_breakdown,
                is_existing_event=True,
                availability_status=availability_status,
                reasoning=reasoning,
                recommendation_score=rec_score,
                recommendation_reasons=rec_reasons,
                is_primary_venue_option=True
            ))
            
            if event.venue:
                suggested_venue_ids.add(event.venue.id)
                venue_suggestion_counts[event.venue.id] = venue_suggestion_counts.get(event.venue.id, 0) + 1
        
        # Process direct venue bookings
        dates_with_venue_suggestions = {}
        
        # Count how many venues with events we have
        venues_with_events_count = len([v for v in venues if v.id in active_venue_ids])
        dates_needing_venues = len([d for d in available_dates 
                                    if not any(s.date == d and s.is_existing_event for s in tour_stops)])

        venue_limit = max(40, min(100, dates_needing_venues * 2, len(venues)))

        # NEW: Always expand search when we have genre preferences to ensure new venues are considered
        has_genre_preference = params.preferred_genres and len(params.preferred_genres) > 0

        if venues_with_events_count < dates_needing_venues or has_genre_preference:
            # Expand search to include more venues, ensuring venues without events are considered
            venue_limit = min(100, len(venues))
            
            # When we're short on venues with events OR have genre preferences,
            # explicitly query for venues without events to ensure they're included
            venues_without_events_query = db.query(Venue)
            if params.preferred_venue_capacity_min:
                venues_without_events_query = venues_without_events_query.filter(
                    Venue.capacity >= params.preferred_venue_capacity_min
                )
            if params.preferred_venue_capacity_max:
                venues_without_events_query = venues_without_events_query.filter(
                    Venue.capacity <= params.preferred_venue_capacity_max
                )
            if params.avoid_venue_ids:
                venues_without_events_query = venues_without_events_query.filter(
                    ~Venue.id.in_(params.avoid_venue_ids)
                )
            
            if active_venue_ids:
                venues_without_events = venues_without_events_query.filter(
                    ~Venue.id.in_(active_venue_ids)
                ).limit(50).all()
            else:
                # If no venues have events, all venues are "without events"
                venues_without_events = venues_without_events_query.limit(50).all()
            
            # Add venues without events to the venues list if they're not already there
            existing_venue_ids = {v.id for v in venues}
            for venue in venues_without_events:
                if venue.id not in existing_venue_ids:
                    venues.append(venue)
        
        # When prioritizing weekends, prefer weekend dates for venue bookings
        if params.prioritize_weekends:
            # Separate weekend and weekday dates
            weekend_dates = [d for d in available_dates if is_weekend(d)]
            weekday_dates = [d for d in available_dates if not is_weekend(d)]
            # Process weekend dates first
            dates_to_process = weekend_dates + weekday_dates
        else:
            dates_to_process = available_dates
        
        # Process dates for venue bookings
        for check_date in dates_to_process:
            date_venue_options = []
            is_weekend_date = is_weekend(check_date)
            
            for venue in venues[:venue_limit]:
                existing_venue_event = (
                    db.query(Event)
                    .filter(
                        Event.venue_id == venue.id,
                        Event.event_date == check_date
                    )
                    .first()
                )
                if existing_venue_event:
                    continue
                
                # Base score - higher for new venues when genre preferences are set
                has_genre_preference = params.preferred_genres and len(params.preferred_genres) > 0
                is_new_venue = venue.id not in active_venue_ids
                
                if is_new_venue and has_genre_preference:
                    # Significantly higher base score for new venues when genres are specified
                    # This ensures they're not filtered out due to lack of genre data
                    base_score = scaled_weights.get('venue_base', cls.DEFAULT_WEIGHT_VENUE_BASE) * 1.5
                else:
                    base_score = scaled_weights.get('venue_base', cls.DEFAULT_WEIGHT_VENUE_BASE)
                
                score = base_score
                score_breakdown = {'base': base_score}
                reasoning = ['Direct venue booking opportunity']
                
                if venue.id in active_venue_ids:
                    active_bonus = scaled_weights.get('active_venue', cls.DEFAULT_WEIGHT_ACTIVE_VENUE)
                    score += active_bonus
                    score_breakdown['active_venue'] = active_bonus
                    reasoning.append('Venue has hosted events')
                else:
                    reasoning.append('New venue (no event history)')
                    # Always give venues without events a bonus to ensure they appear
                    # This is especially important when genre preferences are set,
                    # as new venues shouldn't be excluded for lack of genre data
                    
                    if has_genre_preference:
                        # When genre preferences are specified, give venues without events
                        # a significantly higher bonus than active venues to ensure they're not excluded
                        # This compensates for lack of genre matching data
                        no_event_bonus = scaled_weights.get('active_venue', cls.DEFAULT_WEIGHT_ACTIVE_VENUE) * 1.5
                        score += no_event_bonus
                        score_breakdown['no_event_bonus'] = no_event_bonus
                        reasoning.append('New venue - not excluded by genre preferences')
                    elif venues_with_events_count < dates_needing_venues:
                        # When we're short on venues with events, give a bonus
                        no_event_bonus = scaled_weights.get('active_venue', cls.DEFAULT_WEIGHT_ACTIVE_VENUE) * 0.9
                        score += no_event_bonus
                        score_breakdown['no_event_bonus'] = no_event_bonus
                        reasoning.append('Venue needed to fill tour dates')
                    else:
                        # Even when not short on venues, give a small bonus to ensure
                        # venues without events are still considered
                        no_event_bonus = scaled_weights.get('active_venue', cls.DEFAULT_WEIGHT_ACTIVE_VENUE) * 0.7
                        score += no_event_bonus
                        score_breakdown['no_event_bonus'] = no_event_bonus
                
                if venue.id not in suggested_venue_ids:
                    score += scaled_weights['venue_diversity']
                    score_breakdown['venue_diversity'] = scaled_weights['venue_diversity']
                    reasoning.append('New venue option')
                elif venue_suggestion_counts.get(venue.id, 0) == 1:
                    score -= scaled_weights['venue_diversity'] * 0.5
                    score_breakdown['venue_repeat'] = -scaled_weights['venue_diversity'] * 0.5
                else:
                    score += cls.PENALTY_DUPLICATE_VENUE
                    score_breakdown['venue_duplicate'] = cls.PENALTY_DUPLICATE_VENUE
                
                if venue.id in favorited_venue_ids:
                    score += scaled_weights['favorited_venue'] * 1.5
                    score_breakdown['favorited_venue'] = scaled_weights['favorited_venue'] * 1.5
                    reasoning.append('Favorited venue')
                
                if venue.capacity:
                    score += scaled_weights['venue_quality'] * 0.5
                    score_breakdown['venue_quality'] = scaled_weights['venue_quality'] * 0.5
                
                # Weekend bonus/penalty
                weekend_adjustment = calculate_weekend_penalty(scaled_weights, is_weekend_date, params.prioritize_weekends)
                if weekend_adjustment != 0:
                    score += weekend_adjustment
                    if is_weekend_date:
                        score_breakdown['weekend'] = weekend_adjustment
                        reasoning.append('Weekend date (Friday/Saturday)')
                    else:
                        score_breakdown['weekday_penalty'] = weekend_adjustment
                
                score += scaled_weights['availability']
                score_breakdown['availability'] = scaled_weights['availability']
                
                date_venue_options.append({
                    'venue': venue,
                    'score': score,
                    'score_breakdown': score_breakdown,
                    'reasoning': reasoning,
                    'is_new': venue.id not in suggested_venue_ids,
                    'is_active': venue.id in active_venue_ids,
                    'is_weekend': is_weekend_date
                })
            
            # Sort venues
            if params.prioritize_weekends:
                date_venue_options.sort(key=lambda x: (x['is_weekend'], x['is_active'], x['is_new'], x['score']), reverse=True)
            else:
                date_venue_options.sort(key=lambda x: (x['is_active'], x['is_new'], x['score']), reverse=True)
            
            if date_venue_options:
                best_option = date_venue_options[0]
                
                tour_stops.append(TourStop(
                    date=check_date,
                    venue=best_option['venue'],
                    event=None,
                    distance_from_previous=0.0,
                    distance_from_home=0.0,
                    travel_days_needed=0,
                    score=best_option['score'],
                    score_breakdown=best_option['score_breakdown'],
                    is_existing_event=False,
                    availability_status='available',
                    reasoning=best_option['reasoning'],
                    recommendation_score=None,
                    recommendation_reasons=None,
                    is_primary_venue_option=True
                ))
                
                suggested_venue_ids.add(best_option['venue'].id)
                venue_suggestion_counts[best_option['venue'].id] = venue_suggestion_counts.get(best_option['venue'].id, 0) + 1
        
        return tour_stops

    # Distance calculation methods moved to tour_generator_geocoding_utils.py

    @classmethod
    def _optimize_routing_with_diversity(
        cls,
        tour_stops: List[TourStop],
        params: TourGeneratorParams,
        availability_map: Dict[date, Dict],
        scaled_weights: Dict[str, float],
        db: Session,
        band: Band,
        potential_venues: List
    ) -> List[TourStop]:
        """
        Optimize the routing of tour stops while maintaining venue diversity.
        
        Calculates distances from home location for user display, but uses
        venue-to-venue distances for consecutive shows when more efficient.
        
        Returns:
            Optimized list of tour stops with unique venues
        """
        if not tour_stops:
            return []
        
        # Sort by event priority first (events before venues), then by date
        # This ensures events are processed before direct bookings
        tour_stops.sort(key=lambda x: (not x.is_existing_event, x.date))
        
        selected_venue_ids = set()
        final_tour = []
        last_date = None
        total_distance = 0.0
        
        # Determine home location for distance calculations
        home_location = params.starting_location
        if not home_location and band.location:
            home_location = band.location
        
        for stop in tour_stops:
            # For duplicate venues: only filter out direct bookings, not events
            # Events should always be included (they're prioritized)
            if stop.venue and stop.venue.id in selected_venue_ids:
                if not stop.is_existing_event:
                    # Skip direct bookings at venues that were already selected
                    continue
                # Events can have duplicate venues (same venue, different dates)
                # Only skip if it's the exact same event date
                if any(s.venue.id == stop.venue.id and s.date == stop.date for s in final_tour):
                    continue
            
            if last_date:
                days_gap = (stop.date - last_date).days
                if days_gap < params.min_days_between_shows:
                    continue
                
                # Very lenient thresholds to ensure events and venues appear regardless of genre matching
                # Genre matching is now a scoring factor, not a filter, so lower thresholds ensure inclusion
                score_threshold = 20 if stop.is_existing_event else 15
                if days_gap > params.max_days_between_shows and stop.score < score_threshold:
                    continue
            
            # Calculate distances
            if final_tour and stop.venue:
                prev_stop = final_tour[-1]
                
                # Calculate distance from home
                if home_location:
                    distance_from_home = estimate_distance_from_location(
                        home_location,
                        build_location_string(venue=stop.venue)
                    )
                else:
                    distance_from_home = 0.0
                
                stop.distance_from_home = distance_from_home
                
                # Calculate distance from previous venue
                if prev_stop.venue:
                    distance_from_prev_venue = calculate_distance_between_venues(
                        prev_stop.venue,
                        stop.venue
                    )
                    
                    # Determine which distance to use for routing
                    # Use venue-to-venue distance only for consecutive or near-consecutive shows
                    # where it's more efficient than going home
                    days_between = (stop.date - prev_stop.date).days
                    
                    # For consecutive shows (1-2 days apart), use venue-to-venue if shorter
                    # For shows 3+ days apart, assume band goes home between shows
                    if days_between <= 2:
                        # Consecutive shows - compare distances
                        # Use venue-to-venue if it's shorter than round-trip home
                        distance_home_and_back = prev_stop.distance_from_home + distance_from_home
                        
                        if distance_from_prev_venue < distance_home_and_back:
                            # More efficient to go directly between venues
                            stop.distance_from_previous = distance_from_prev_venue
                            stop.reasoning.append('Direct travel from previous venue')
                        else:
                            # More efficient to go home between shows
                            stop.distance_from_previous = distance_from_home
                            stop.reasoning.append('Travel from home location')
                    else:
                        # Shows are far apart - assume band goes home
                        stop.distance_from_previous = distance_from_home
                        if days_between > 2:
                            stop.reasoning.append('Travel from home location (sufficient time between shows)')
                    
                    distance = stop.distance_from_previous
                else:
                    # Previous venue unknown, use distance from home
                    stop.distance_from_previous = distance_from_home
                    distance = distance_from_home
                
                driving_hours = distance / cls.AVERAGE_DRIVING_SPEED_KMH
                stop.travel_days_needed = max(
                    0,
                    int(driving_hours / params.max_drive_hours_per_day)
                )
                
                if distance < 320:
                    stop.score += scaled_weights['travel_efficiency']
                    stop.score_breakdown['travel_efficiency'] = scaled_weights['travel_efficiency']
                    if 'Efficient routing' not in stop.reasoning:
                        stop.reasoning.append('Efficient routing')
                elif distance > 800:
                    stop.score += cls.PENALTY_LONG_DRIVE
                    stop.score_breakdown['long_drive'] = cls.PENALTY_LONG_DRIVE
                    if 'Long drive required' not in stop.reasoning:
                        stop.reasoning.append('Long drive required')
                
                days_between = (stop.date - prev_stop.date).days
                if stop.travel_days_needed >= days_between:
                    stop.score += cls.PENALTY_LONG_DRIVE
                    stop.reasoning.append('Insufficient travel time')
                    if stop.travel_days_needed > days_between - 1:
                        continue
            elif home_location and stop.venue:
                # First stop - calculate from home
                distance_from_home = estimate_distance_from_location(
                    home_location,
                    build_location_string(venue=stop.venue)
                )
                stop.distance_from_home = distance_from_home
                stop.distance_from_previous = distance_from_home
            else:
                stop.distance_from_home = 0.0
                stop.distance_from_previous = 0.0
            
            if total_distance + stop.distance_from_previous > params.tour_radius_km:
                # Very lenient thresholds to ensure events and venues appear regardless of genre matching
                # Genre matching is now a scoring factor, not a filter, so lower thresholds ensure inclusion
                score_threshold = 20 if stop.is_existing_event else 15
                if stop.score < score_threshold:
                    continue
            
            final_tour.append(stop)
            if stop.venue:
                selected_venue_ids.add(stop.venue.id)
            last_date = stop.date
            total_distance += stop.distance_from_previous
            
            if len(final_tour) >= 20:
                break
        
        # Final sort: events first (by date), then venues (by date)
        final_tour.sort(key=lambda x: (not x.is_existing_event, x.date, -x.score))
        
        # Fill gaps between events with direct bookings
        final_tour = cls._fill_gaps_with_venue_bookings(
            final_tour, params, availability_map, scaled_weights, db, band, potential_venues
        )
        
        return final_tour

    @classmethod
    def _fill_gaps_with_venue_bookings(
        cls,
        tour_stops: List[TourStop],
        params: TourGeneratorParams,
        availability_map: Dict[date, Dict],
        scaled_weights: Dict[str, float],
        db: Session,
        band: Band,
        potential_venues: List
    ) -> List[TourStop]:
        """
        Fill large gaps between events with direct venue bookings.
        
        Returns:
            Tour stops with gaps filled by venue bookings
        """
        if not tour_stops:
            return tour_stops
        
        # Separate events and existing venue bookings
        events = [s for s in tour_stops if s.is_existing_event]
        existing_venue_bookings = {s.date for s in tour_stops if not s.is_existing_event}
        selected_venue_ids = {s.venue.id for s in tour_stops if s.venue}
        
        if len(events) < 2:
            return tour_stops  # Need at least 2 events to have gaps
        
        # Sort events by date
        events.sort(key=lambda x: x.date)
        
        # Get favorited venues for scoring
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}
        
        # Get active venue IDs (venues that have hosted events)
        active_venue_query = db.query(Event.venue_id).distinct().all()
        active_venue_ids = {v[0] for v in active_venue_query}
        
        gap_fillers = []
        
        # Check gaps between consecutive events
        for i in range(len(events) - 1):
            current_event = events[i]
            next_event = events[i + 1]
            gap_days = (next_event.date - current_event.date).days
            
            # If gap is larger than max_days_between_shows, try to fill it
            if gap_days > params.max_days_between_shows:
                # Calculate travel time needed
                if current_event.venue and next_event.venue:
                    distance = calculate_distance_between_venues(
                        current_event.venue,
                        next_event.venue
                    )
                    travel_days_needed = max(
                        0,
                        int((distance / cls.AVERAGE_DRIVING_SPEED_KMH) / params.max_drive_hours_per_day)
                    )
                else:
                    travel_days_needed = 1
                
                # Try to fill gap with 1-2 venue bookings to reduce gap
                target_fill_count = min(
                    2,  # Fill with up to 2 venues
                    max(1, gap_days - params.max_days_between_shows)  # At least reduce gap
                )
                
                if target_fill_count > 0:
                    # Find available dates in the gap
                    gap_start = current_event.date + timedelta(days=max(travel_days_needed + 1, params.min_days_between_shows))
                    gap_end = next_event.date - timedelta(days=1)
                    
                    available_dates_in_gap = []
                    current_date = gap_start
                    while current_date <= gap_end and len(available_dates_in_gap) < target_fill_count * 2:  # Get more options
                        if current_date not in existing_venue_bookings:
                            availability = availability_map.get(current_date, {})
                            if availability.get('is_available'):
                                # Prioritize weekend dates when filling gaps
                                if params.prioritize_weekends:
                                    if is_weekend(current_date):
                                        # Add weekend dates to the front of the list
                                        available_dates_in_gap.insert(0, current_date)
                                    else:
                                        # Add weekday dates to the end
                                        available_dates_in_gap.append(current_date)
                                else:
                                    available_dates_in_gap.append(current_date)
                        current_date += timedelta(days=1)
                    
                    # For each available date, find best venue booking
                    for fill_date in available_dates_in_gap[:target_fill_count]:
                        best_venue_booking = None
                        best_score = -9999.0
                        
                        for venue in potential_venues[:50]:  # Check top 50 venues
                            # Skip if venue already used
                            if venue.id in selected_venue_ids:
                                continue
                            
                            # Skip if venue has an event on this date
                            existing_event = (
                                db.query(Event)
                                .filter(
                                    Event.venue_id == venue.id,
                                    Event.event_date == fill_date
                                )
                                .first()
                            )
                            if existing_event:
                                continue
                            
                            # Calculate score for this venue booking
                            # Start with base score to ensure all venues can qualify
                            score = scaled_weights.get('venue_base', cls.DEFAULT_WEIGHT_VENUE_BASE)
                            
                            # Bonus for active venues
                            if venue.id in active_venue_ids:
                                score += scaled_weights.get('active_venue', cls.DEFAULT_WEIGHT_ACTIVE_VENUE)
                            
                            # Distance from previous event
                            if current_event.venue:
                                distance_from_prev = calculate_distance_between_venues(
                                    current_event.venue,
                                    venue
                                )
                            else:
                                distance_from_prev = 320.0  # Default
                            
                            # Distance to next event
                            if next_event.venue:
                                distance_to_next = calculate_distance_between_venues(
                                    venue,
                                    next_event.venue
                                )
                            else:
                                distance_to_next = 320.0  # Default
                            
                            # Prefer venues that minimize total routing distance
                            total_distance = distance_from_prev + distance_to_next
                            if total_distance < 640:  # Good routing
                                score += scaled_weights.get('travel_efficiency', 20.0)
                            elif total_distance > 1600:  # Poor routing
                                score -= scaled_weights.get('travel_efficiency', 20.0) * 0.5
                            
                            # Favorited venue bonus
                            if venue.id in favorited_venue_ids:
                                score += scaled_weights.get('favorited_venue', 10.0) * 1.5
                            
                            # Weekend bonus/penalty for gap fillers
                            if is_weekend(fill_date) and params.prioritize_weekends:
                                score += scaled_weights.get('weekend_bonus', 10.0) * 1.5
                            elif not is_weekend(fill_date) and params.prioritize_weekends:
                                # Stronger penalty for weekdays/Sundays to match other scoring
                                score -= scaled_weights.get('weekend_bonus', 10.0) * 0.6
                            
                            # Availability bonus
                            score += scaled_weights.get('availability', 40.0)
                            
                            if score > best_score:
                                best_score = score
                                
                                # Calculate travel days
                                travel_days = max(
                                    0,
                                    int((distance_from_prev / cls.AVERAGE_DRIVING_SPEED_KMH) / params.max_drive_hours_per_day)
                                )
                                
                                reasoning = ['Fills gap between events']
                                if venue.id in favorited_venue_ids:
                                    reasoning.append('Favorited venue')
                                if is_weekend(fill_date):
                                    reasoning.append('Weekend date (Fri/Sat)')
                                if venue.id in active_venue_ids:
                                    reasoning.append('Venue has hosted events')
                                else:
                                    reasoning.append('New venue (no event history)')
                                
                                best_venue_booking = TourStop(
                                    date=fill_date,
                                    venue=venue,
                                    event=None,
                                    distance_from_previous=distance_from_prev,
                                    distance_from_home=0.0,
                                    travel_days_needed=travel_days,
                                    score=score,
                                    score_breakdown={'gap_filler': score},
                                    is_existing_event=False,
                                    availability_status='available',
                                    reasoning=reasoning,
                                    recommendation_score=None,
                                    recommendation_reasons=None,
                                    is_primary_venue_option=True
                                )
                        
                        if best_venue_booking and best_score > 0:
                            gap_fillers.append(best_venue_booking)
                            selected_venue_ids.add(best_venue_booking.venue.id)
        
        # Combine events, gap fillers, and existing venue bookings
        all_stops = tour_stops + gap_fillers
        
        # Sort by date
        all_stops.sort(key=lambda x: x.date)
        
        # Determine home location
        home_location = params.starting_location
        if not home_location:
            # Try to get from band profile if available
            home_location = band.location if band.location else None

        # Recalculate distances for all stops
        for i in range(len(all_stops)):
            if all_stops[i].venue:
                # Calculate distance from home
                if home_location:
                    all_stops[i].distance_from_home = estimate_distance_from_location(
                        home_location,
                        build_location_string(venue=all_stops[i].venue)
                    )
                else:
                    all_stops[i].distance_from_home = 0.0
                
                # Calculate distance from previous (for routing optimization)
                if i > 0 and all_stops[i-1].venue:
                    distance_from_prev_venue = calculate_distance_between_venues(
                        all_stops[i-1].venue,
                        all_stops[i].venue
                    )
                    
                    days_between = (all_stops[i].date - all_stops[i-1].date).days
                    
                    # Use same logic as in _optimize_routing_with_diversity
                    if days_between <= 2:
                        distance_home_and_back = (all_stops[i-1].distance_from_home + 
                                                all_stops[i].distance_from_home)
                        if distance_from_prev_venue < distance_home_and_back:
                            all_stops[i].distance_from_previous = distance_from_prev_venue
                        else:
                            all_stops[i].distance_from_previous = all_stops[i].distance_from_home
                    else:
                        all_stops[i].distance_from_previous = all_stops[i].distance_from_home
                    
                    driving_hours = all_stops[i].distance_from_previous / cls.AVERAGE_DRIVING_SPEED_KMH
                    all_stops[i].travel_days_needed = max(
                        0,
                        int(driving_hours / params.max_drive_hours_per_day)
                    )

        # Final sort: events first, then by date
        all_stops.sort(key=lambda x: (not x.is_existing_event, x.date, -x.score))
        
        return all_stops[:20]  # Limit to 20 stops

    @classmethod
    def _calculate_tour_efficiency(
        cls,
        tour_stops: List[TourStop],
        total_distance: float,
        total_travel_days: int,
        total_show_days: int
    ) -> float:
        """
        Calculate overall tour efficiency score.
        
        Returns:
            Efficiency score from 0-100
        """
        if not tour_stops:
            return 0.0
        
        avg_score = sum(s.score for s in tour_stops) / len(tour_stops)
        base_score = min(100, max(0, avg_score))
        
        unique_venues = len(set(s.venue.id for s in tour_stops if s.venue))
        diversity_bonus = min(15, (unique_venues / len(tour_stops)) * 15)
        
        if total_show_days > 0:
            total_days = total_show_days + total_travel_days
            show_ratio = total_show_days / total_days if total_days > 0 else 0
            efficiency_bonus = show_ratio * 20
            
            km_per_show = total_distance / total_show_days
            if km_per_show < 320:
                efficiency_bonus += 10
            elif km_per_show > 800:
                efficiency_bonus -= 10
            
            return min(100, max(0, base_score + efficiency_bonus + diversity_bonus))
        
        return base_score

    @classmethod
    def _format_event_recommendations(
        cls,
        tour_stops: List[TourStop],
        params: TourGeneratorParams
    ) -> List[Dict]:
        """
        Format tour stops with existing events as recommendations.
        
        Returns:
            List of event recommendations with details
        """
        recommendations = []
        
        for stop in tour_stops:
            if stop.is_existing_event and stop.event:
                recommendations.append({
                    'event_id': stop.event.id,
                    'event_name': stop.event.name,
                    'event_date': stop.date.isoformat(),
                    'venue_id': stop.venue.id,
                    'venue_name': stop.venue.name,
                    'venue_location': f"{stop.venue.city}, {stop.venue.state}",
                    'venue_capacity': stop.venue.capacity,
                    'distance_from_previous_km': round(stop.distance_from_previous, 1),
                    'distance_from_home_km': round(stop.distance_from_home, 1),
                    'travel_days_needed': stop.travel_days_needed,
                    'tour_score': round(stop.score, 1),
                    'recommendation_score': round(stop.recommendation_score, 1) if stop.recommendation_score else None,
                    'availability_status': stop.availability_status,
                    'reasoning': stop.reasoning,
                    'is_open_for_applications': stop.event.is_open_for_applications,
                    'genre_tags': stop.event.genre_tags,
                    'priority': 'high' if stop.score > 70 else 'medium' if stop.score > 40 else 'low',
                    'image_path': stop.event.image_path,
                })
        
        return recommendations

    @classmethod
    def _format_venue_recommendations(
        cls,
        tour_stops: List[TourStop],
        params: TourGeneratorParams
    ) -> List[Dict]:
        """
        Format venues for direct booking recommendations.
        
        Returns:
            List of venue recommendations with contact suggestions
        """
        recommendations = []
        
        for stop in tour_stops:
            if not stop.is_existing_event:
                recommendations.append({
                    'venue_id': stop.venue.id,
                    'venue_name': stop.venue.name,
                    'suggested_date': stop.date.isoformat(),
                    'venue_location': f"{stop.venue.city}, {stop.venue.state}",
                    'venue_capacity': stop.venue.capacity,
                    'venue_contact_name': stop.venue.contact_name,
                    'venue_contact_email': stop.venue.contact_email,
                    'venue_contact_phone': stop.venue.contact_phone,
                    'has_sound_provided': stop.venue.has_sound_provided,
                    'has_parking': stop.venue.has_parking,
                    'distance_from_previous_km': round(stop.distance_from_previous, 1),
                    'distance_from_home_km': round(stop.distance_from_home, 1),
                    'travel_days_needed': stop.travel_days_needed,
                    'score': round(stop.score, 1),
                    'availability_status': stop.availability_status,
                    'reasoning': stop.reasoning,
                    'booking_priority': 'high' if stop.score > 50 else 'medium' if stop.score > 30 else 'low',
                    'day_of_week': stop.date.strftime('%A'),
                    'image_path': stop.venue.image_path
                })
        
        return recommendations

    @classmethod
    def _identify_availability_conflicts(
        cls,
        availability_map: Dict[date, Dict],
        tour_stops: List[TourStop]
    ) -> List[Dict]:
        """
        Identify any availability conflicts in the tour.
        
        Returns:
            List of conflict details
        """
        conflicts = []
        
        for stop in tour_stops:
            availability = availability_map.get(stop.date, {})
            
            if not availability.get('is_available'):
                conflict = {
                    'date': stop.date.isoformat(),
                    'venue_name': stop.venue.name if stop.venue else 'Unknown',
                    'conflict_type': 'band_unavailable',
                    'unavailable_members': availability.get('unavailable_count', 0),
                    'tentative_members': availability.get('tentative_count', 0),
                }
                
                if availability.get('band_event_id'):
                    conflict['conflict_type'] = 'existing_booking'
                    conflict['existing_event_id'] = availability['band_event_id']
                
                conflicts.append(conflict)
            
            if stop.travel_days_needed > 0:
                travel_date = stop.date - timedelta(days=1)
                travel_availability = availability_map.get(travel_date, {})
                
                if not travel_availability.get('is_available'):
                    conflicts.append({
                        'date': travel_date.isoformat(),
                        'venue_name': f"Travel day to {stop.venue.name}",
                        'conflict_type': 'travel_day_unavailable',
                        'unavailable_members': travel_availability.get('unavailable_count', 0),
                    })
        
        return conflicts

    @classmethod
    def _generate_routing_warnings(
        cls,
        tour_stops: List[TourStop],
        total_distance: float
    ) -> List[str]:
        """
        Generate warnings about routing issues.
        
        Returns:
            List of warning messages
        """
        warnings = []
        
        if total_distance > 4800:
            warnings.append(f"Total tour distance ({round(total_distance)} km) exceeds typical touring range")
        
        for stop in tour_stops:
            if stop.distance_from_previous > 800:
                warnings.append(
                    f"Long drive ({round(stop.distance_from_previous)} km) to "
                    f"{stop.venue.name} on {stop.date.isoformat()}"
                )
        
        # Sort by date to check consecutive shows chronologically
        sorted_stops = sorted(tour_stops, key=lambda x: x.date)
        
        for i in range(1, len(sorted_stops)):
            days_gap = (sorted_stops[i].date - sorted_stops[i-1].date).days
            if days_gap > 7:
                warnings.append(
                    f"Large gap ({days_gap} days) between shows on "
                    f"{sorted_stops[i-1].date.isoformat()} and {sorted_stops[i].date.isoformat()}"
                )
        
        if len(sorted_stops) >= 3:
            for i in range(2, len(sorted_stops)):
                if sorted_stops[i].venue and sorted_stops[i-2].venue:
                    loc_current = f"{sorted_stops[i].venue.city}, {sorted_stops[i].venue.state}"
                    loc_prev2 = f"{sorted_stops[i-2].venue.city}, {sorted_stops[i-2].venue.state}"
                    
                    if loc_current.lower() == loc_prev2.lower():
                        warnings.append(
                            f"Potential backtracking detected: returning to {sorted_stops[i].venue.city} "
                            f"on {sorted_stops[i].date.isoformat()}"
                        )
        
        venue_ids = [s.venue.id for s in tour_stops if s.venue]
        unique_venues = len(set(venue_ids))
        if unique_venues < len(venue_ids) * 0.7:
            warnings.append(
                f"Limited venue diversity: {unique_venues} unique venues out of {len(venue_ids)} stops"
            )
        
        return warnings

    @classmethod
    def _empty_result(cls, reason: str) -> TourGeneratorResult:
        """
        Return an empty result with a reason.
        
        Returns:
            Empty TourGeneratorResult
        """
        return TourGeneratorResult(
            recommended_events=[],
            recommended_venues=[],
            tour_stops=[],
            total_distance_km=0.0,
            total_travel_days=0,
            total_show_days=0,
            tour_efficiency_score=0.0,
            availability_conflicts=[],
            routing_warnings=[reason]
        )
