"""
Tour Generator Service

Generates optimized tour schedules for bands by analyzing:
- Band and member availability
- Geographic routing and travel distances
- Venue and event opportunities
- Genre matching and venue compatibility
- Event recommendation scores
"""

from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass
from math import radians, sin, cos, sqrt, atan2

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


class TourGeneratorService:
    """
    Service for generating optimized band tours.
    """
    
    EARTH_RADIUS_KM = 6371.0
    AVERAGE_DRIVING_SPEED_KMH = 80.0
    
    # Scoring weights
    WEIGHT_RECOMMENDATION_SYSTEM = 35.0  # Use recommendation system score
    WEIGHT_GENRE_MATCH = 15.0  # Reduced since recommendation system handles this
    WEIGHT_VENUE_SIZE_MATCH = 15.0
    WEIGHT_WEEKEND_BONUS = 10.0
    WEIGHT_TRAVEL_EFFICIENCY = 20.0
    WEIGHT_VENUE_QUALITY = 15.0
    WEIGHT_EXISTING_EVENT = 20.0  # Reduced to balance with recommendation
    WEIGHT_ROUTING_CONTINUITY = 25.0
    WEIGHT_AVAILABILITY = 40.0
    WEIGHT_FAVORITED_VENUE = 10.0
    WEIGHT_VENUE_DIVERSITY = 20.0  # New weight for venue variety
    
    # Penalties
    PENALTY_LONG_DRIVE = -15.0
    PENALTY_BACKTRACKING = -20.0
    PENALTY_GAP_TOO_LONG = -10.0
    PENALTY_UNAVAILABLE = -100.0
    PENALTY_DUPLICATE_VENUE = -50.0  # Penalty for suggesting same venue again

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
            params: Tour generation parameters
            
        Returns:
            TourGeneratorResult containing recommended events and venues
        """
        band = db.query(Band).filter(Band.id == params.band_id).first()
        if not band:
            return cls._empty_result("Band not found")
        
        # Get band availability for the tour period
        availability_map = cls._get_band_availability_map(
            db, band, params.start_date, params.end_date
        )
        
        # Find available dates
        available_dates = cls._find_available_dates(
            availability_map, params.start_date, params.end_date
        )
        
        if not available_dates:
            return cls._empty_result("No available dates found in tour period")
        
        # Get existing events that match criteria
        matching_events = cls._find_matching_events(
            db, band, params, available_dates
        )
        
        # Get recommendation scores for events
        event_recommendations = cls._get_event_recommendation_scores(
            db, band, matching_events
        )
        
        # Get potential venues
        potential_venues = cls._find_potential_venues(
            db, band, params
        )
        
        # Generate tour stops combining events and venues
        tour_stops = cls._generate_tour_stops(
            db, band, params, matching_events, potential_venues, 
            available_dates, availability_map, event_recommendations
        )
        
        # Optimize routing with venue diversity
        optimized_tour = cls._optimize_routing_with_diversity(
            tour_stops, params, availability_map
        )
        
        # Calculate metrics
        total_distance = sum(stop.distance_from_previous for stop in optimized_tour)
        total_travel_days = sum(stop.travel_days_needed for stop in optimized_tour)
        total_show_days = len(optimized_tour)
        
        # Calculate efficiency score
        efficiency_score = cls._calculate_tour_efficiency(
            optimized_tour, total_distance, total_travel_days, total_show_days
        )
        
        # Generate recommendations
        recommended_events = cls._format_event_recommendations(
            optimized_tour, params
        )
        
        recommended_venues = cls._format_venue_recommendations(
            optimized_tour, params
        )
        
        # Find conflicts and warnings
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
        
        # Filter by dates
        query = query.filter(
            Event.event_date.in_(available_dates),
            Event.status == EventStatus.PENDING.value,
            Event.is_open_for_applications == True
        )
        
        # Filter by venue capacity if specified
        if params.preferred_venue_capacity_min:
            query = query.filter(
                Venue.capacity >= params.preferred_venue_capacity_min
            )
        if params.preferred_venue_capacity_max:
            query = query.filter(
                Venue.capacity <= params.preferred_venue_capacity_max
            )
        
        # Exclude avoided venues
        if params.avoid_venue_ids:
            query = query.filter(
                ~Venue.id.in_(params.avoid_venue_ids)
            )
        
        # Filter by genres if specified
        if params.preferred_genres and band.genre:
            genre_filters = []
            for genre in params.preferred_genres:
                genre_filters.append(Event.genre_tags.ilike(f"%{genre}%"))
            if genre_filters:
                query = query.filter(or_(*genre_filters))
        
        events = query.options(joinedload(Event.venue)).all()
        
        # Filter out events the band has already applied to
        applied_event_ids = {
            app.event_id for app in 
            db.query(EventApplication)
            .filter(EventApplication.band_id == band.id)
            .all()
        }
        
        # Filter out events the band is already booked for
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
        
        # Get band's application history for the recommendation service
        applications = (
            db.query(EventApplication)
            .filter(EventApplication.band_id == band.id)
            .all()
        )
        applied_event_ids = {app.event_id: app for app in applications}
        
        # Get venues where band was previously accepted/rejected
        accepted_venue_ids = set()
        rejected_venue_ids = set()
        for app in applications:
            event = db.query(Event).filter(Event.id == app.event_id).first()
            if event:
                if app.status == ApplicationStatus.ACCEPTED.value:
                    accepted_venue_ids.add(event.venue_id)
                elif app.status == ApplicationStatus.REJECTED.value:
                    rejected_venue_ids.add(event.venue_id)
        
        # Get band's upcoming booked events
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
        
        # Get application counts per event
        application_counts = dict(
            db.query(EventApplication.event_id, func.count(EventApplication.id))
            .group_by(EventApplication.event_id)
            .all()
        )
        
        # Get favorited venues
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}
        
        # Get similar bands data for collaborative filtering
        similar_bands_data = RecommendationService._get_similar_bands_data(
            db, band, accepted_venue_ids
        )
        
        # Score each event
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
            
            # Convert reasons to dict format
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
        Find venues that could host the band.
        
        Returns:
            List of potential venues sorted by relevance
        """
        query = db.query(Venue)
        
        # Filter by capacity
        if params.preferred_venue_capacity_min:
            query = query.filter(
                Venue.capacity >= params.preferred_venue_capacity_min
            )
        if params.preferred_venue_capacity_max:
            query = query.filter(
                Venue.capacity <= params.preferred_venue_capacity_max
            )
        
        # Exclude avoided venues
        if params.avoid_venue_ids:
            query = query.filter(
                ~Venue.id.in_(params.avoid_venue_ids)
            )
        
        venues = query.all()
        
        # Get venues where band has performed before (positive signal)
        previous_venues = (
            db.query(Venue.id)
            .join(Event)
            .join(BandEvent)
            .filter(BandEvent.band_id == band.id)
            .distinct()
            .all()
        )
        previous_venue_ids = {v[0] for v in previous_venues}
        
        # Get favorited venues
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}
        
        # Sort venues by relevance
        scored_venues = []
        for venue in venues:
            score = 0.0
            
            # Bonus for previous success
            if venue.id in previous_venue_ids:
                score += 20.0
            
            # Bonus for favorited venue
            if venue.id in favorited_venue_ids:
                score += 15.0
            
            # Genre matching based on venue history
            if band.genre and venue.events:
                venue_genres = set()
                for event in venue.events:
                    if event.genre_tags:
                        venue_genres.update(
                            g.strip().lower() 
                            for g in event.genre_tags.split(',')
                        )
                
                band_genres = set(
                    g.strip().lower() 
                    for g in band.genre.split(',')
                )
                
                if band_genres & venue_genres:
                    score += 15.0
            
            # Add location diversity score (prefer different cities)
            location_score = 5.0  # Base diversity score
            score += location_score
            
            scored_venues.append((venue, score))
        
        # Sort by score and return more venues for diversity
        scored_venues.sort(key=lambda x: x[1], reverse=True)
        return [v[0] for v in scored_venues[:100]]  # Increased from 50 to 100 for more variety

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
        event_recommendations: Dict[int, Tuple[float, List[Dict]]]
    ) -> List[TourStop]:
        """
        Generate potential tour stops from events and venues with venue diversity.
        
        Returns:
            List of scored tour stops with diverse venue options
        """
        tour_stops = []
        
        # Get favorited venues
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}
        
        # Track which venues have been suggested
        suggested_venue_ids = set()
        venue_suggestion_counts = {}
        
        # Process existing events
        for event in events:
            if event.event_date not in available_dates:
                continue
            
            availability = availability_map.get(event.event_date, {})
            
            # Get recommendation score for this event
            rec_score, rec_reasons = event_recommendations.get(event.id, (0.0, []))
            
            # Calculate base score
            score = 0.0
            score_breakdown = {}
            reasoning = []
            
            # Add recommendation system score (normalized to our scale)
            if rec_score > 0:
                normalized_rec_score = min(cls.WEIGHT_RECOMMENDATION_SYSTEM, 
                                         (rec_score / 100) * cls.WEIGHT_RECOMMENDATION_SYSTEM)
                score += normalized_rec_score
                score_breakdown['recommendation_system'] = normalized_rec_score
                reasoning.append('High recommendation score')
                
                # Add top recommendation reasons
                top_reasons = sorted(rec_reasons, key=lambda x: x['score'], reverse=True)[:2]
                for reason in top_reasons:
                    reasoning.append(reason['label'])
            
            # Existing event bonus
            score += cls.WEIGHT_EXISTING_EVENT
            score_breakdown['existing_event'] = cls.WEIGHT_EXISTING_EVENT
            reasoning.append('Existing event open for applications')
            
            # Favorited venue bonus
            if event.venue and event.venue.id in favorited_venue_ids:
                score += cls.WEIGHT_FAVORITED_VENUE
                score_breakdown['favorited_venue'] = cls.WEIGHT_FAVORITED_VENUE
                reasoning.append('Favorited venue')
            
            # Weekend bonus
            if event.event_date.weekday() in [4, 5, 6]:  # Friday, Saturday, Sunday
                if params.prioritize_weekends:
                    score += cls.WEIGHT_WEEKEND_BONUS
                    score_breakdown['weekend'] = cls.WEIGHT_WEEKEND_BONUS
                    reasoning.append('Weekend show')
            
            # Venue size matching
            if event.venue and event.venue.capacity:
                if params.preferred_venue_capacity_min and params.preferred_venue_capacity_max:
                    if (params.preferred_venue_capacity_min <= event.venue.capacity <= 
                        params.preferred_venue_capacity_max):
                        score += cls.WEIGHT_VENUE_SIZE_MATCH
                        score_breakdown['venue_size'] = cls.WEIGHT_VENUE_SIZE_MATCH
                        reasoning.append('Venue size matches preferences')
            
            # Availability scoring
            if availability.get('is_available'):
                score += cls.WEIGHT_AVAILABILITY
                score_breakdown['availability'] = cls.WEIGHT_AVAILABILITY
                availability_status = 'available'
            elif availability.get('tentative_count', 0) > 0:
                score += cls.WEIGHT_AVAILABILITY * 0.5
                score_breakdown['availability'] = cls.WEIGHT_AVAILABILITY * 0.5
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
            
            # Track this venue
            if event.venue:
                suggested_venue_ids.add(event.venue.id)
                venue_suggestion_counts[event.venue.id] = venue_suggestion_counts.get(event.venue.id, 0) + 1
        
        # Process venues for dates without events - ensure diversity
        dates_with_venue_suggestions = {}
        
        for check_date in available_dates:
            # Skip if there's already an event on this date
            if any(s.date == check_date and s.is_existing_event for s in tour_stops):
                continue
            
            availability = availability_map.get(check_date, {})
            if not availability.get('is_available'):
                continue  # Skip unavailable dates for direct bookings
            
            # Find best venues for this date, prioritizing unsugggested venues
            date_venue_options = []
            
            for venue in venues[:40]:  # Check more venues for diversity
                # Skip dates with existing venue events
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
                
                # Calculate score for venue booking
                score = 0.0
                score_breakdown = {}
                reasoning = ['Direct venue booking opportunity']
                
                # Apply diversity bonus/penalty
                if venue.id not in suggested_venue_ids:
                    # First time suggesting this venue - big bonus
                    score += cls.WEIGHT_VENUE_DIVERSITY
                    score_breakdown['venue_diversity'] = cls.WEIGHT_VENUE_DIVERSITY
                    reasoning.append('New venue option')
                elif venue_suggestion_counts.get(venue.id, 0) == 1:
                    # Second suggestion - small penalty
                    score -= cls.WEIGHT_VENUE_DIVERSITY * 0.5
                    score_breakdown['venue_repeat'] = -cls.WEIGHT_VENUE_DIVERSITY * 0.5
                else:
                    # Multiple suggestions - larger penalty
                    score += cls.PENALTY_DUPLICATE_VENUE
                    score_breakdown['venue_duplicate'] = cls.PENALTY_DUPLICATE_VENUE
                
                # Favorited venue bonus
                if venue.id in favorited_venue_ids:
                    score += cls.WEIGHT_FAVORITED_VENUE * 1.5  # Higher weight for direct booking
                    score_breakdown['favorited_venue'] = cls.WEIGHT_FAVORITED_VENUE * 1.5
                    reasoning.append('Favorited venue')
                
                # Venue quality score
                if venue.capacity:
                    score += cls.WEIGHT_VENUE_QUALITY * 0.5
                    score_breakdown['venue_quality'] = cls.WEIGHT_VENUE_QUALITY * 0.5
                
                # Weekend bonus
                if check_date.weekday() in [4, 5, 6] and params.prioritize_weekends:
                    score += cls.WEIGHT_WEEKEND_BONUS
                    score_breakdown['weekend'] = cls.WEIGHT_WEEKEND_BONUS
                    reasoning.append('Weekend date')
                
                # Availability scoring
                score += cls.WEIGHT_AVAILABILITY
                score_breakdown['availability'] = cls.WEIGHT_AVAILABILITY
                
                date_venue_options.append({
                    'venue': venue,
                    'score': score,
                    'score_breakdown': score_breakdown,
                    'reasoning': reasoning,
                    'is_new': venue.id not in suggested_venue_ids
                })
            
            # Sort by score and prioritize new venues
            date_venue_options.sort(key=lambda x: (x['is_new'], x['score']), reverse=True)
            
            # Add the best venue option for this date (if any)
            if date_venue_options:
                best_option = date_venue_options[0]
                
                tour_stops.append(TourStop(
                    date=check_date,
                    venue=best_option['venue'],
                    event=None,
                    distance_from_previous=0.0,
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
                
                # Track this venue
                suggested_venue_ids.add(best_option['venue'].id)
                venue_suggestion_counts[best_option['venue'].id] = venue_suggestion_counts.get(best_option['venue'].id, 0) + 1
                
                # Store alternative options for this date
                dates_with_venue_suggestions[check_date] = date_venue_options[1:4]  # Keep top 3 alternatives
        
        return tour_stops

    @classmethod
    def _calculate_distance(
        cls,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """
        Calculate distance between two points using Haversine formula.
        
        Returns:
            Distance in kilometers
        """
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lon = radians(lon2 - lon1)
        
        a = sin(delta_lat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        return cls.EARTH_RADIUS_KM * c

    @classmethod
    def _estimate_distance_from_location(
        cls,
        location1: str,
        location2: str
    ) -> float:
        """
        Estimate distance between two location strings.
        
        This is a simplified estimation based on city/state matching.
        In production, you'd want to use a geocoding service.
        
        Returns:
            Estimated distance in kilometers
        """
        if not location1 or not location2:
            return 160.0  # Default medium distance
        
        loc1_lower = location1.lower().strip()
        loc2_lower = location2.lower().strip()
        
        # Same location
        if loc1_lower == loc2_lower:
            return 0.0
        
        # Extract city and state
        loc1_parts = [p.strip() for p in loc1_lower.replace(',', ' ').split()]
        loc2_parts = [p.strip() for p in loc2_lower.replace(',', ' ').split()]
        
        # Check for common parts (city or state match)
        common_parts = set(loc1_parts) & set(loc2_parts)
        
        if common_parts:
            # Some overlap - probably same state or region
            return 240.0
        else:
            # No overlap - different regions
            return 640.0

    @classmethod
    def _optimize_routing_with_diversity(
        cls,
        tour_stops: List[TourStop],
        params: TourGeneratorParams,
        availability_map: Dict[date, Dict]
    ) -> List[TourStop]:
        """
        Optimize the routing of tour stops while maintaining venue diversity.
        
        Returns:
            Optimized list of tour stops with unique venues
        """
        if not tour_stops:
            return []
        
        # Sort stops by date initially
        tour_stops.sort(key=lambda x: x.date)
        
        # Track selected venues to ensure diversity
        selected_venue_ids = set()
        final_tour = []
        last_date = None
        total_distance = 0.0
        
        for stop in tour_stops:
            # Skip if venue already in tour (unless it's an existing event with high score)
            if stop.venue and stop.venue.id in selected_venue_ids:
                if not stop.is_existing_event or stop.score < 70:
                    continue
            
            # Check minimum days between shows
            if last_date:
                days_gap = (stop.date - last_date).days
                if days_gap < params.min_days_between_shows:
                    continue
                
                # Skip if gap is too large (unless high value)
                if days_gap > params.max_days_between_shows and stop.score < 50:
                    continue
            
            # Calculate distance from previous stop
            if final_tour:
                prev_stop = final_tour[-1]
                if prev_stop.venue and stop.venue:
                    distance = cls._estimate_distance_from_location(
                        f"{prev_stop.venue.city}, {prev_stop.venue.state}",
                        f"{stop.venue.city}, {stop.venue.state}"
                    )
                    stop.distance_from_previous = distance
                    
                    # Calculate travel days needed
                    driving_hours = distance / cls.AVERAGE_DRIVING_SPEED_KMH
                    stop.travel_days_needed = max(
                        0,
                        int(driving_hours / params.max_drive_hours_per_day)
                    )
                    
                    # Apply travel efficiency scoring
                    if distance < 320:  # Short drive
                        stop.score += cls.WEIGHT_TRAVEL_EFFICIENCY
                        stop.score_breakdown['travel_efficiency'] = cls.WEIGHT_TRAVEL_EFFICIENCY
                        stop.reasoning.append('Efficient routing')
                    elif distance > 800:  # Long drive
                        stop.score += cls.PENALTY_LONG_DRIVE
                        stop.score_breakdown['long_drive'] = cls.PENALTY_LONG_DRIVE
                        stop.reasoning.append('Long drive required')
                    
                    # Check for travel day availability
                    days_between = (stop.date - prev_stop.date).days
                    if stop.travel_days_needed >= days_between:
                        stop.score += cls.PENALTY_LONG_DRIVE
                        stop.reasoning.append('Insufficient travel time')
                        # Skip if travel is not feasible
                        if stop.travel_days_needed > days_between - 1:
                            continue
            elif params.starting_location and stop.venue:
                # First stop - distance from starting location
                stop.distance_from_previous = cls._estimate_distance_from_location(
                    params.starting_location,
                    f"{stop.venue.city}, {stop.venue.state}"
                )
            else:
                stop.distance_from_previous = 0.0
            
            # Check total distance limit
            if total_distance + stop.distance_from_previous > params.tour_radius_km:
                if not stop.is_existing_event or stop.score < 75:
                    continue
            
            # Add to final tour
            final_tour.append(stop)
            if stop.venue:
                selected_venue_ids.add(stop.venue.id)
            last_date = stop.date
            total_distance += stop.distance_from_previous
            
            # Stop if we have enough dates
            if len(final_tour) >= 20:
                break
        
        # Re-sort by date and score for final optimization
        final_tour.sort(key=lambda x: (x.date, -x.score))
        
        return final_tour

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
        
        # Base score from average stop scores
        avg_score = sum(s.score for s in tour_stops) / len(tour_stops)
        base_score = min(100, max(0, avg_score))
        
        # Venue diversity bonus
        unique_venues = len(set(s.venue.id for s in tour_stops if s.venue))
        diversity_bonus = min(15, (unique_venues / len(tour_stops)) * 15)
        
        # Efficiency factors
        if total_show_days > 0:
            # Ratio of show days to total days
            total_days = total_show_days + total_travel_days
            show_ratio = total_show_days / total_days if total_days > 0 else 0
            efficiency_bonus = show_ratio * 20
            
            # Distance efficiency (km per show)
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
                    'travel_days_needed': stop.travel_days_needed,
                    'tour_score': round(stop.score, 1),
                    'recommendation_score': round(stop.recommendation_score, 1) if stop.recommendation_score else None,
                    'availability_status': stop.availability_status,
                    'reasoning': stop.reasoning,
                    'is_open_for_applications': stop.event.is_open_for_applications,
                    'genre_tags': stop.event.genre_tags,
                    'priority': 'high' if stop.score > 70 else 'medium' if stop.score > 40 else 'low'
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
                    'travel_days_needed': stop.travel_days_needed,
                    'score': round(stop.score, 1),
                    'availability_status': stop.availability_status,
                    'reasoning': stop.reasoning,
                    'booking_priority': 'high' if stop.score > 50 else 'medium' if stop.score > 30 else 'low',
                    'day_of_week': stop.date.strftime('%A')
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
            
            # Check travel day conflicts
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
        
        if total_distance > 4800:  # ~3000 miles in km
            warnings.append(f"Total tour distance ({round(total_distance)} km) exceeds typical touring range")
        
        # Check for long drives
        for stop in tour_stops:
            if stop.distance_from_previous > 800:
                warnings.append(
                    f"Long drive ({round(stop.distance_from_previous)} km) to "
                    f"{stop.venue.name} on {stop.date.isoformat()}"
                )
        
        # Check for gaps
        for i in range(1, len(tour_stops)):
            days_gap = (tour_stops[i].date - tour_stops[i-1].date).days
            if days_gap > 7:
                warnings.append(
                    f"Large gap ({days_gap} days) between shows on "
                    f"{tour_stops[i-1].date.isoformat()} and {tour_stops[i].date.isoformat()}"
                )
        
        # Check for backtracking
        if len(tour_stops) >= 3:
            for i in range(2, len(tour_stops)):
                if tour_stops[i].venue and tour_stops[i-2].venue:
                    loc_current = f"{tour_stops[i].venue.city}, {tour_stops[i].venue.state}"
                    loc_prev2 = f"{tour_stops[i-2].venue.city}, {tour_stops[i-2].venue.state}"
                    
                    if loc_current.lower() == loc_prev2.lower():
                        warnings.append(
                            f"Potential backtracking detected: returning to {tour_stops[i].venue.city} "
                            f"on {tour_stops[i].date.isoformat()}"
                        )
        
        # Check venue diversity
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
