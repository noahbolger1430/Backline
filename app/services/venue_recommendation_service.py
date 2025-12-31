"""
Venue Recommendation Service

Provides band recommendations for venue owners when:
1. Searching for bands to add to an event
2. Reviewing band applications for an event

Uses a scoring system based on:
- Genre matching (event and venue history)
- Previous success at venue
- Gig activity level
- Profile completeness
- Location proximity
"""

from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Band,
    BandEvent,
    Event,
    EventApplication,
    Venue,
)
from app.models.event_application import ApplicationStatus


class VenueRecommendationService:
    """
    Service for generating band recommendations for venue owners.
    """

    # Phase 1: Rule-Based Scoring Weights
    
    # Genre matching
    EVENT_GENRE_EXACT_MATCH = 35.0      # Band genre exactly matches event genre_tags
    EVENT_GENRE_PARTIAL_MATCH = 20.0    # Band genre partially matches event genre_tags
    VENUE_GENRE_EXACT_MATCH = 20.0      # Band genre matches venue's booking history
    VENUE_GENRE_PARTIAL_MATCH = 14.0    # Band genre partially matches venue history
    
    # Venue relationship
    PREVIOUS_SUCCESS_SCORE = 15.0       # Band was previously booked at this venue
    PREVIOUS_REJECTION_PENALTY = -10.0  # Band was previously rejected (minor penalty)
    
    # Band quality signals
    GIG_ACTIVITY_HIGH = 15.0            # Very active (5+ gigs in last 6 months)
    GIG_ACTIVITY_MEDIUM = 10.0          # Moderately active (2-4 gigs)
    GIG_ACTIVITY_LOW = 5.0              # Some activity (1 gig)
    
    PROFILE_COMPLETE_SCORE = 10.0       # Full profile (bio, image, all socials)
    PROFILE_PARTIAL_SCORE = 5.0         # Partial profile
    
    # Location
    LOCATION_SAME_CITY = 15.0           # Band in same city as venue
    LOCATION_SAME_STATE = 10.0          # Band in same state
    LOCATION_NEARBY = 5.0               # Partial location match

    @staticmethod
    def get_recommended_bands_for_event(
        db: Session,
        event_id: int,
        venue_id: int,
        limit: int = 20,
        search_term: Optional[str] = None,
    ) -> List[Dict]:
        """
        Get recommended bands for an event (used in band search).
        
        Args:
            db: Database session
            event_id: The event to get recommendations for
            venue_id: The venue hosting the event
            limit: Maximum number of bands to return
            search_term: Optional search filter
            
        Returns:
            List of bands with recommendation scores and reasons
        """
        # Get event and venue
        event = db.query(Event).filter(Event.id == event_id).first()
        venue = db.query(Venue).filter(Venue.id == venue_id).first()
        
        if not event or not venue:
            return []
        
        # Get all bands (optionally filtered by search term)
        bands_query = db.query(Band)
        if search_term:
            bands_query = bands_query.filter(
                Band.name.ilike(f"%{search_term}%")
            )
        bands = bands_query.limit(100).all()  # Limit for performance
        
        # Get bands already on this event
        existing_band_ids = {
            be.band_id for be in 
            db.query(BandEvent).filter(BandEvent.event_id == event_id).all()
        }
        
        # Get venue's booking history for genre analysis
        venue_booked_genres = VenueRecommendationService._get_venue_genre_history(
            db, venue_id
        )
        
        # Get bands that have been booked/rejected at this venue
        venue_band_history = VenueRecommendationService._get_venue_band_history(
            db, venue_id
        )
        
        # Score each band
        scored_bands = []
        for band in bands:
            # Skip bands already on the event
            if band.id in existing_band_ids:
                continue
            
            score, reasons = VenueRecommendationService._score_band_for_event(
                db=db,
                band=band,
                event=event,
                venue=venue,
                venue_booked_genres=venue_booked_genres,
                venue_band_history=venue_band_history,
            )
            
            scored_bands.append({
                "band": band,
                "score": score,
                "reasons": reasons,
            })
        
        # Sort by score descending
        scored_bands.sort(key=lambda x: x["score"], reverse=True)
        
        return scored_bands[:limit]

    @staticmethod
    def score_applicants_for_event(
        db: Session,
        event_id: int,
    ) -> List[Dict]:
        """
        Score all applicants for an event to help venue owners prioritize.
        
        Args:
            db: Database session
            event_id: The event to score applicants for
            
        Returns:
            List of applications with scores and reasons
        """
        # Get event with venue
        event = (
            db.query(Event)
            .options(joinedload(Event.venue))
            .filter(Event.id == event_id)
            .first()
        )
        
        if not event or not event.venue:
            return []
        
        venue = event.venue
        
        # Get all applications for this event
        applications = (
            db.query(EventApplication)
            .options(joinedload(EventApplication.band))
            .filter(EventApplication.event_id == event_id)
            .all()
        )
        
        if not applications:
            return []
        
        # Get venue's booking history
        venue_booked_genres = VenueRecommendationService._get_venue_genre_history(
            db, venue.id
        )
        venue_band_history = VenueRecommendationService._get_venue_band_history(
            db, venue.id
        )
        
        # Score each applicant
        scored_applicants = []
        for application in applications:
            band = application.band
            if not band:
                continue
            
            score, reasons = VenueRecommendationService._score_band_for_event(
                db=db,
                band=band,
                event=event,
                venue=venue,
                venue_booked_genres=venue_booked_genres,
                venue_band_history=venue_band_history,
                application=application,
            )
            
            scored_applicants.append({
                "application": application,
                "band": band,
                "score": score,
                "reasons": reasons,
            })
        
        # Sort by score descending
        scored_applicants.sort(key=lambda x: x["score"], reverse=True)
        
        return scored_applicants

    @staticmethod
    def _score_band_for_event(
        db: Session,
        band: Band,
        event: Event,
        venue: Venue,
        venue_booked_genres: List[str],
        venue_band_history: Dict[int, str],
        application: Optional[EventApplication] = None,
    ) -> Tuple[float, List[Dict]]:
        """
        Calculate recommendation score for a band.
        
        Returns:
            Tuple of (total_score, list_of_reasons)
        """
        score = 0.0
        reasons = []
        
        # 1. Genre matching
        genre_score, genre_reason = VenueRecommendationService._calculate_genre_match(
            band=band,
            event=event,
            venue_booked_genres=venue_booked_genres,
        )
        if genre_score > 0:
            score += genre_score
            reasons.append(genre_reason)
        
        # 2. Previous success/rejection at venue
        if band.id in venue_band_history:
            history_status = venue_band_history[band.id]
            if history_status == "booked":
                score += VenueRecommendationService.PREVIOUS_SUCCESS_SCORE
                reasons.append({
                    "type": "previous_success",
                    "label": "Previously booked here",
                    "score": VenueRecommendationService.PREVIOUS_SUCCESS_SCORE,
                })
            elif history_status == "rejected":
                score += VenueRecommendationService.PREVIOUS_REJECTION_PENALTY
                reasons.append({
                    "type": "previous_rejection",
                    "label": "Previously not selected",
                    "score": VenueRecommendationService.PREVIOUS_REJECTION_PENALTY,
                })
        
        # 3. Gig activity
        activity_score, activity_reason = VenueRecommendationService._calculate_gig_activity(
            db, band
        )
        if activity_score > 0:
            score += activity_score
            reasons.append(activity_reason)
        
        # 4. Profile completeness
        profile_score, profile_reason = VenueRecommendationService._calculate_profile_completeness(
            band
        )
        if profile_score > 0:
            score += profile_score
            reasons.append(profile_reason)
        
        # 5. Location proximity
        location_score, location_reason = VenueRecommendationService._calculate_location_proximity(
            band, venue
        )
        if location_score > 0:
            score += location_score
            reasons.append(location_reason)
        
        return score, reasons

    @staticmethod
    def _get_venue_genre_history(db: Session, venue_id: int) -> List[str]:
        """
        Get list of genres that have been booked at this venue.
        """
        booked_bands = (
            db.query(Band.genre)
            .join(BandEvent)
            .join(Event)
            .filter(
                Event.venue_id == venue_id,
                Band.genre.isnot(None),
            )
            .distinct()
            .all()
        )
        
        genres = []
        for (genre,) in booked_bands:
            if genre:
                # Split comma-separated genres
                for g in genre.split(","):
                    g_clean = g.strip().lower()
                    if g_clean and g_clean not in genres:
                        genres.append(g_clean)
        
        return genres

    @staticmethod
    def _get_venue_band_history(db: Session, venue_id: int) -> Dict[int, str]:
        """
        Get history of bands at this venue.
        
        Returns:
            Dict mapping band_id -> status ("booked" or "rejected")
        """
        history = {}
        
        # Get booked bands
        booked = (
            db.query(BandEvent.band_id)
            .join(Event)
            .filter(Event.venue_id == venue_id)
            .distinct()
            .all()
        )
        for (band_id,) in booked:
            history[band_id] = "booked"
        
        # Get rejected applications (only if not already booked)
        rejected = (
            db.query(EventApplication.band_id)
            .join(Event)
            .filter(
                Event.venue_id == venue_id,
                EventApplication.status == ApplicationStatus.REJECTED.value,
            )
            .distinct()
            .all()
        )
        for (band_id,) in rejected:
            if band_id not in history:
                history[band_id] = "rejected"
        
        return history

    @staticmethod
    def _calculate_genre_match(
        band: Band,
        event: Event,
        venue_booked_genres: List[str],
    ) -> Tuple[float, Optional[Dict]]:
        """
        Calculate genre match score.
        """
        if not band.genre:
            return 0.0, None
        
        band_genres = set(g.strip().lower() for g in band.genre.split(",") if g.strip())
        
        # Tier 1: Check event's explicit genre_tags
        if event.genre_tags:
            event_genres = set(
                g.strip().lower() for g in event.genre_tags.split(",") if g.strip()
            )
            
            # Exact match
            if band_genres & event_genres:
                return (
                    VenueRecommendationService.EVENT_GENRE_EXACT_MATCH,
                    {
                        "type": "event_genre_match",
                        "label": "Genre matches event",
                        "score": VenueRecommendationService.EVENT_GENRE_EXACT_MATCH,
                    },
                )
            
            # Partial match (substring)
            for bg in band_genres:
                for eg in event_genres:
                    if bg in eg or eg in bg:
                        return (
                            VenueRecommendationService.EVENT_GENRE_PARTIAL_MATCH,
                            {
                                "type": "event_genre_partial",
                                "label": "Similar genre to event",
                                "score": VenueRecommendationService.EVENT_GENRE_PARTIAL_MATCH,
                            },
                        )
        
        # Tier 2: Check venue's booking history
        if venue_booked_genres:
            venue_genre_set = set(venue_booked_genres)
            
            # Exact match with venue history
            if band_genres & venue_genre_set:
                return (
                    VenueRecommendationService.VENUE_GENRE_EXACT_MATCH,
                    {
                        "type": "venue_genre_match",
                        "label": "Genre fits venue",
                        "score": VenueRecommendationService.VENUE_GENRE_EXACT_MATCH,
                    },
                )
            
            # Partial match with venue history
            for bg in band_genres:
                for vg in venue_genre_set:
                    if bg in vg or vg in bg:
                        return (
                            VenueRecommendationService.VENUE_GENRE_PARTIAL_MATCH,
                            {
                                "type": "venue_genre_partial",
                                "label": "Similar to venue's acts",
                                "score": VenueRecommendationService.VENUE_GENRE_PARTIAL_MATCH,
                            },
                        )
        
        return 0.0, None

    @staticmethod
    def _calculate_gig_activity(db: Session, band: Band) -> Tuple[float, Optional[Dict]]:
        """
        Calculate gig activity score based on recent bookings.
        """
        six_months_ago = date.today() - timedelta(days=180)
        
        gig_count = (
            db.query(func.count(BandEvent.id))
            .join(Event)
            .filter(
                BandEvent.band_id == band.id,
                Event.event_date >= six_months_ago,
            )
            .scalar()
        )
        
        if gig_count >= 5:
            return (
                VenueRecommendationService.GIG_ACTIVITY_HIGH,
                {
                    "type": "gig_activity_high",
                    "label": "Very active (5+ recent gigs)",
                    "score": VenueRecommendationService.GIG_ACTIVITY_HIGH,
                },
            )
        elif gig_count >= 2:
            return (
                VenueRecommendationService.GIG_ACTIVITY_MEDIUM,
                {
                    "type": "gig_activity_medium",
                    "label": "Active band",
                    "score": VenueRecommendationService.GIG_ACTIVITY_MEDIUM,
                },
            )
        elif gig_count == 1:
            return (
                VenueRecommendationService.GIG_ACTIVITY_LOW,
                {
                    "type": "gig_activity_low",
                    "label": "Recently performed",
                    "score": VenueRecommendationService.GIG_ACTIVITY_LOW,
                },
            )
        
        return 0.0, None

    @staticmethod
    def _calculate_profile_completeness(band: Band) -> Tuple[float, Optional[Dict]]:
        """
        Calculate profile completeness score.
        """
        completeness_items = [
            bool(band.description),
            bool(band.image_path),
            bool(band.genre),
            bool(band.location),
            bool(band.spotify_url),
            bool(band.instagram_url or band.facebook_url or band.website_url),
        ]
        
        filled_count = sum(completeness_items)
        total_count = len(completeness_items)
        
        if filled_count == total_count:
            return (
                VenueRecommendationService.PROFILE_COMPLETE_SCORE,
                {
                    "type": "profile_complete",
                    "label": "Complete profile",
                    "score": VenueRecommendationService.PROFILE_COMPLETE_SCORE,
                },
            )
        elif filled_count >= total_count * 0.6:
            return (
                VenueRecommendationService.PROFILE_PARTIAL_SCORE,
                {
                    "type": "profile_partial",
                    "label": "Good profile",
                    "score": VenueRecommendationService.PROFILE_PARTIAL_SCORE,
                },
            )
        
        return 0.0, None

    @staticmethod
    def _calculate_location_proximity(
        band: Band,
        venue: Venue,
    ) -> Tuple[float, Optional[Dict]]:
        """
        Calculate location proximity score.
        """
        if not band.location:
            return 0.0, None
        
        band_location = band.location.lower().strip()
        venue_city = venue.city.lower().strip() if venue.city else ""
        venue_state = venue.state.lower().strip() if venue.state else ""
        
        # Check for city match
        if venue_city and venue_city in band_location:
            return (
                VenueRecommendationService.LOCATION_SAME_CITY,
                {
                    "type": "location_local",
                    "label": "Local band",
                    "score": VenueRecommendationService.LOCATION_SAME_CITY,
                },
            )
        
        # Check for state match
        if venue_state and venue_state in band_location:
            return (
                VenueRecommendationService.LOCATION_SAME_STATE,
                {
                    "type": "location_state",
                    "label": f"From {venue.state}",
                    "score": VenueRecommendationService.LOCATION_SAME_STATE,
                },
            )
        
        # Partial location match (any word overlap)
        band_words = set(band_location.replace(",", " ").split())
        venue_words = set()
        if venue_city:
            venue_words.update(venue_city.split())
        if venue_state:
            venue_words.update(venue_state.split())
        
        if band_words & venue_words:
            return (
                VenueRecommendationService.LOCATION_NEARBY,
                {
                    "type": "location_nearby",
                    "label": "Nearby",
                    "score": VenueRecommendationService.LOCATION_NEARBY,
                },
            )
        
        return 0.0, None

