from datetime import date, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AvailabilityStatus,
    Band,
    BandAvailability,
    BandEvent,
    BandMemberAvailability,
    Event,
    EventApplication,
    GigView,
    Venue,
)
from app.models.venue_favorite import VenueFavorite
from app.models.event import EventStatus
from app.models.event_application import ApplicationStatus
from app.schemas.recommendation import RecommendationReason, RecommendedGig


class RecommendationService:
    """
    Service for generating gig recommendations for bands.
    
    Uses a scoring system based on:
    - Availability matching
    - Genre matching
    - Past success at venue
    - Event freshness (time until event)
    - Competition level (number of applications)
    """

    # Scoring weights
    AVAILABILITY_SCORE = 25.0  # Band is available on event date
    
    # Genre matching - tiered scoring (higher = more relevant match)
    EVENT_GENRE_MATCH_SCORE = 35.0     # Direct match with event's genre_tags (highest)
    EVENT_GENRE_PARTIAL_SCORE = 25.0   # Partial match with event's genre_tags
    VENUE_GENRE_MATCH_SCORE = 20.0     # Match based on venue's booking history (medium)
    VENUE_GENRE_PARTIAL_SCORE = 14.0   # Partial match with venue history
    NO_GENRE_DATA_SCORE = 6.0          # No genre data available (lowest fallback)
    
    PAST_SUCCESS_SCORE = 20.0  # Previously accepted at this venue
    PAST_REJECTION_PENALTY = -15.0  # Previously rejected at this venue
    VENUE_FAVORITED_SCORE = 5.0  # Band has favorited this venue
    FRESHNESS_BONUS = 15.0     # Event is in the sweet spot timing
    LOW_COMPETITION_BONUS = 10.0  # Few other applicants
    
    # Collaborative filtering - "Similar bands" scoring
    # Similar bands = bands that have been accepted at the same venues as target band
    SIMILAR_BANDS_HIGH_SCORE = 25.0    # Many similar bands accepted at this venue (3+)
    SIMILAR_BANDS_MEDIUM_SCORE = 18.0  # Some similar bands accepted (2)
    SIMILAR_BANDS_LOW_SCORE = 12.0     # One similar band accepted at this venue
    SIMILAR_GENRE_BANDS_SCORE = 8.0    # Same-genre bands accepted at venue (weaker signal)

    @staticmethod
    def get_recommended_gigs(
        db: Session,
        band: Band,
        limit: int = 20,
        include_applied: bool = True,
    ) -> List[RecommendedGig]:
        """
        Get recommended gigs for a band, sorted by recommendation score.
        
        Args:
            db: Database session
            band: The band to get recommendations for
            limit: Maximum number of recommendations to return
            include_applied: Whether to include gigs the band has already applied to
        """
        # Get all open events
        events = (
            db.query(Event)
            .options(joinedload(Event.venue))
            .filter(
                Event.status == EventStatus.PENDING.value,
                Event.is_open_for_applications == True,
                Event.event_date >= date.today(),
            )
            .all()
        )

        # Get band's application history
        applications = (
            db.query(EventApplication)
            .filter(EventApplication.band_id == band.id)
            .all()
        )
        applied_event_ids = {app.event_id: app for app in applications}

        # Get venues where band was previously accepted
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
        booked_dates = {be.event.event_date for be in booked_events}

        # Get application counts per event
        application_counts = dict(
            db.query(EventApplication.event_id, func.count(EventApplication.id))
            .group_by(EventApplication.event_id)
            .all()
        )

        # Get favorited venues for this band
        favorite_venues = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band.id)
            .all()
        )
        favorited_venue_ids = {fv.venue_id for fv in favorite_venues}

        # PHASE 2: Collaborative Filtering - Find similar bands
        # Similar bands = bands that have been accepted at the same venues as this band
        similar_bands_data = RecommendationService._get_similar_bands_data(
            db, band, accepted_venue_ids
        )

        # Score each event
        scored_events: List[Tuple[Event, float, List[RecommendationReason]]] = []
        
        for event in events:
            # Skip if already applied and not including applied events
            if not include_applied and event.id in applied_event_ids:
                continue

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

            # Only include events with positive scores
            if score > 0:
                scored_events.append((event, score, reasons))

        # Sort by score descending
        scored_events.sort(key=lambda x: x[1], reverse=True)

        # Convert to response objects
        recommended_gigs = []
        for event, score, reasons in scored_events[:limit]:
            application = applied_event_ids.get(event.id)
            
            recommended_gig = RecommendedGig(
                id=event.id,
                name=event.name,
                description=event.description,
                event_date=event.event_date,
                doors_time=event.doors_time,
                show_time=event.show_time,
                is_ticketed=event.is_ticketed,
                ticket_price=event.ticket_price,
                is_age_restricted=event.is_age_restricted,
                age_restriction=event.age_restriction,
                image_path=event.image_path,
                is_recurring=event.is_recurring,
                recurring_frequency=event.recurring_frequency,
                genre_tags=event.genre_tags,
                venue_id=event.venue.id,
                venue_name=event.venue.name,
                venue_city=event.venue.city,
                venue_state=event.venue.state,
                venue_image_path=event.venue.image_path,
                recommendation_score=score,
                recommendation_reasons=reasons,
                has_applied=application is not None,
                application_status=application.status if application else None,
                application_count=application_counts.get(event.id, 0),
            )
            recommended_gigs.append(recommended_gig)

        return recommended_gigs

    @staticmethod
    def _score_event_for_band(
        db: Session,
        event: Event,
        band: Band,
        accepted_venue_ids: set,
        rejected_venue_ids: set,
        booked_dates: set,
        application_count: int,
        similar_bands_data: dict = None,
        favorited_venue_ids: set = None,
    ) -> Tuple[float, List[RecommendationReason]]:
        """
        Calculate recommendation score for a single event.
        
        Args:
            similar_bands_data: Dict containing:
                - 'similar_band_ids': set of band IDs that are similar to target band
                - 'similar_bands_per_venue': dict mapping venue_id -> set of similar band IDs accepted there
                - 'genre_bands_per_venue': dict mapping venue_id -> count of same-genre bands accepted
        
        Returns:
            Tuple of (total_score, list_of_reasons)
        """
        score = 0.0
        reasons: List[RecommendationReason] = []

        # 1. Availability check
        is_available = RecommendationService._is_band_available(
            db, band, event.event_date, booked_dates
        )
        
        if is_available:
            score += RecommendationService.AVAILABILITY_SCORE
            reasons.append(RecommendationReason(
                type="availability",
                label="You're available",
                score=RecommendationService.AVAILABILITY_SCORE,
            ))
        else:
            # If not available, return early with zero score
            return 0.0, []

        # 2. Genre matching (tiered: event genre > venue history > no data)
        if band.genre:
            genre_score, genre_reason_type, genre_label = RecommendationService._calculate_genre_match(
                db, band.genre, event
            )
            if genre_score > 0:
                score += genre_score
                reasons.append(RecommendationReason(
                    type=genre_reason_type,
                    label=genre_label,
                    score=genre_score,
                ))

        # 3. Past success/rejection at venue
        if event.venue_id in accepted_venue_ids:
            score += RecommendationService.PAST_SUCCESS_SCORE
            reasons.append(RecommendationReason(
                type="past_success",
                label="Previously accepted here",
                score=RecommendationService.PAST_SUCCESS_SCORE,
            ))
        elif event.venue_id in rejected_venue_ids:
            score += RecommendationService.PAST_REJECTION_PENALTY
            reasons.append(RecommendationReason(
                type="past_rejection",
                label="Previously not selected",
                score=RecommendationService.PAST_REJECTION_PENALTY,
            ))

        # 3.5. Venue favorited by band
        if favorited_venue_ids and event.venue_id in favorited_venue_ids:
            score += RecommendationService.VENUE_FAVORITED_SCORE
            reasons.append(RecommendationReason(
                type="venue_favorited",
                label="Favorited venue",
                score=RecommendationService.VENUE_FAVORITED_SCORE,
            ))

        # 4. PHASE 2: Collaborative Filtering - Similar bands accepted at this venue
        if similar_bands_data and event.venue_id not in accepted_venue_ids:
            collab_score, collab_reason = RecommendationService._calculate_collaborative_score(
                db, event.venue_id, band, similar_bands_data
            )
            if collab_score > 0:
                score += collab_score
                reasons.append(collab_reason)

        # 5. Event freshness (sweet spot: 2-8 weeks out)
        days_until_event = (event.event_date - date.today()).days
        if 14 <= days_until_event <= 60:
            score += RecommendationService.FRESHNESS_BONUS
            reasons.append(RecommendationReason(
                type="timing",
                label="Good timing",
                score=RecommendationService.FRESHNESS_BONUS,
            ))

        # 6. Competition factor
        if application_count < 3:
            score += RecommendationService.LOW_COMPETITION_BONUS
            reasons.append(RecommendationReason(
                type="low_competition",
                label=f"Low competition ({application_count} applicants)",
                score=RecommendationService.LOW_COMPETITION_BONUS,
            ))

        return score, reasons

    @staticmethod
    def _is_band_available(
        db: Session,
        band: Band,
        target_date: date,
        booked_dates: set,
    ) -> bool:
        """
        Check if band is available on a specific date.
        """
        # Check if already booked
        if target_date in booked_dates:
            return False

        # Check band-level availability block
        band_block = (
            db.query(BandAvailability)
            .filter(
                BandAvailability.band_id == band.id,
                BandAvailability.date == target_date,
                BandAvailability.status == AvailabilityStatus.UNAVAILABLE.value,
            )
            .first()
        )
        if band_block:
            return False

        # Check if ALL members are unavailable
        member_ids = [member.id for member in band.members]
        if not member_ids:
            return True  # No members means available by default

        unavailable_count = (
            db.query(BandMemberAvailability)
            .filter(
                BandMemberAvailability.band_member_id.in_(member_ids),
                BandMemberAvailability.date == target_date,
                BandMemberAvailability.status == AvailabilityStatus.UNAVAILABLE.value,
            )
            .count()
        )

        # Band is unavailable only if ALL members are unavailable
        return unavailable_count < len(member_ids)

    @staticmethod
    def _calculate_genre_match(
        db: Session,
        band_genre: str,
        event: Event,
    ) -> Tuple[float, str, str]:
        """
        Calculate genre match score with tiered matching:
        1. Direct match with event's genre_tags (highest score)
        2. Match based on venue's booking history (medium score)
        3. No data available (lowest fallback score)
        
        Returns:
            Tuple of (score, reason_type, reason_label)
        """
        if not band_genre:
            return 0.0, "", ""

        band_genre_lower = band_genre.lower().strip()
        band_genres = set(g.strip() for g in band_genre_lower.split(",") if g.strip())

        # TIER 1: Check event's explicit genre_tags (highest priority)
        if event.genre_tags:
            event_genres = set(g.strip().lower() for g in event.genre_tags.split(",") if g.strip())
            
            # Check for exact match
            if band_genres & event_genres:  # Intersection - any genre matches
                return (
                    RecommendationService.EVENT_GENRE_MATCH_SCORE,
                    "event_genre_match",
                    "Genre matches event",
                )
            
            # Check for partial match (substring matching)
            for band_g in band_genres:
                for event_g in event_genres:
                    if band_g in event_g or event_g in band_g:
                        return (
                            RecommendationService.EVENT_GENRE_PARTIAL_SCORE,
                            "event_genre_partial",
                            "Similar genre to event",
                        )

        # TIER 2: Check venue's booking history (medium priority)
        if event.venue_id:
            booked_bands = (
                db.query(Band.genre)
                .join(BandEvent)
                .join(Event)
                .filter(
                    Event.venue_id == event.venue_id,
                    Band.genre.isnot(None),
                )
                .distinct()
                .all()
            )

            if booked_bands:
                for (venue_band_genre,) in booked_bands:
                    if venue_band_genre:
                        venue_genres = set(g.strip().lower() for g in venue_band_genre.split(",") if g.strip())
                        
                        # Exact match with venue history
                        if band_genres & venue_genres:
                            return (
                                RecommendationService.VENUE_GENRE_MATCH_SCORE,
                                "venue_genre_match",
                                "Genre fits venue",
                            )
                        
                        # Partial match with venue history
                        for band_g in band_genres:
                            for venue_g in venue_genres:
                                if band_g in venue_g or venue_g in band_g:
                                    return (
                                        RecommendationService.VENUE_GENRE_PARTIAL_SCORE,
                                        "venue_genre_partial",
                                        "Similar to venue's acts",
                                    )
                
                # Venue has history but no match
                return 0.0, "", ""

        # TIER 3: No genre data available - give small fallback score
        # This encourages exploring new venues/events that haven't specified preferences
        return (
            RecommendationService.NO_GENRE_DATA_SCORE,
            "genre_discovery",
            "New opportunity",
        )

    @staticmethod
    def _get_similar_bands_data(
        db: Session,
        band: Band,
        accepted_venue_ids: set,
    ) -> dict:
        """
        Find bands similar to the target band based on shared venue acceptances.
        
        A band is "similar" if:
        1. It has been accepted at the same venues as the target band
        2. It has the same/similar genre as the target band
        
        Returns:
            Dict containing:
                - 'similar_band_ids': set of band IDs similar to target
                - 'similar_bands_per_venue': dict mapping venue_id -> set of similar band IDs accepted
                - 'genre_bands_per_venue': dict mapping venue_id -> count of same-genre bands accepted
        """
        similar_band_ids = set()
        similar_bands_per_venue = {}
        genre_bands_per_venue = {}
        
        if not accepted_venue_ids:
            # Band hasn't been accepted anywhere yet - use genre-based similarity
            if band.genre:
                band_genres = set(g.strip().lower() for g in band.genre.split(",") if g.strip())
                
                # Find all venues and count same-genre bands accepted there
                all_acceptances = (
                    db.query(
                        Event.venue_id,
                        Band.id.label("band_id"),
                        Band.genre,
                    )
                    .join(EventApplication, EventApplication.event_id == Event.id)
                    .join(Band, Band.id == EventApplication.band_id)
                    .filter(
                        EventApplication.status == ApplicationStatus.ACCEPTED.value,
                        Band.id != band.id,
                        Band.genre.isnot(None),
                    )
                    .all()
                )
                
                for venue_id, other_band_id, other_genre in all_acceptances:
                    if other_genre:
                        other_genres = set(g.strip().lower() for g in other_genre.split(",") if g.strip())
                        # Check for genre overlap
                        if band_genres & other_genres:
                            if venue_id not in genre_bands_per_venue:
                                genre_bands_per_venue[venue_id] = 0
                            genre_bands_per_venue[venue_id] += 1
            
            return {
                'similar_band_ids': similar_band_ids,
                'similar_bands_per_venue': similar_bands_per_venue,
                'genre_bands_per_venue': genre_bands_per_venue,
            }
        
        # Find bands that have been accepted at the same venues as this band
        other_bands_at_same_venues = (
            db.query(Band.id, Event.venue_id)
            .join(EventApplication, EventApplication.band_id == Band.id)
            .join(Event, Event.id == EventApplication.event_id)
            .filter(
                Event.venue_id.in_(accepted_venue_ids),
                EventApplication.status == ApplicationStatus.ACCEPTED.value,
                Band.id != band.id,  # Exclude the target band
            )
            .all()
        )
        
        # Build set of similar band IDs
        for other_band_id, _ in other_bands_at_same_venues:
            similar_band_ids.add(other_band_id)
        
        if not similar_band_ids:
            return {
                'similar_band_ids': similar_band_ids,
                'similar_bands_per_venue': similar_bands_per_venue,
                'genre_bands_per_venue': genre_bands_per_venue,
            }
        
        # Find which venues these similar bands have been accepted at
        similar_bands_acceptances = (
            db.query(Band.id, Event.venue_id)
            .join(EventApplication, EventApplication.band_id == Band.id)
            .join(Event, Event.id == EventApplication.event_id)
            .filter(
                Band.id.in_(similar_band_ids),
                EventApplication.status == ApplicationStatus.ACCEPTED.value,
            )
            .all()
        )
        
        # Build mapping of venue_id -> similar bands accepted there
        for similar_band_id, venue_id in similar_bands_acceptances:
            if venue_id not in similar_bands_per_venue:
                similar_bands_per_venue[venue_id] = set()
            similar_bands_per_venue[venue_id].add(similar_band_id)
        
        # Also track genre-based matches for fallback
        if band.genre:
            band_genres = set(g.strip().lower() for g in band.genre.split(",") if g.strip())
            
            genre_band_acceptances = (
                db.query(Event.venue_id, Band.id, Band.genre)
                .join(EventApplication, EventApplication.event_id == Event.id)
                .join(Band, Band.id == EventApplication.band_id)
                .filter(
                    EventApplication.status == ApplicationStatus.ACCEPTED.value,
                    Band.id != band.id,
                    Band.genre.isnot(None),
                )
                .all()
            )
            
            for venue_id, other_band_id, other_genre in genre_band_acceptances:
                if other_genre:
                    other_genres = set(g.strip().lower() for g in other_genre.split(",") if g.strip())
                    if band_genres & other_genres:
                        if venue_id not in genre_bands_per_venue:
                            genre_bands_per_venue[venue_id] = 0
                        genre_bands_per_venue[venue_id] += 1
        
        return {
            'similar_band_ids': similar_band_ids,
            'similar_bands_per_venue': similar_bands_per_venue,
            'genre_bands_per_venue': genre_bands_per_venue,
        }

    @staticmethod
    def _calculate_collaborative_score(
        db: Session,
        venue_id: int,
        band: Band,
        similar_bands_data: dict,
    ) -> Tuple[float, Optional[RecommendationReason]]:
        """
        Calculate collaborative filtering score for an event at a venue.
        
        Checks if bands similar to the target band have been accepted at this venue.
        
        Returns:
            Tuple of (score, RecommendationReason or None)
        """
        similar_bands_per_venue = similar_bands_data.get('similar_bands_per_venue', {})
        genre_bands_per_venue = similar_bands_data.get('genre_bands_per_venue', {})
        
        # Check if similar bands (from shared venues) have been accepted here
        similar_bands_at_venue = similar_bands_per_venue.get(venue_id, set())
        similar_count = len(similar_bands_at_venue)
        
        if similar_count >= 3:
            return (
                RecommendationService.SIMILAR_BANDS_HIGH_SCORE,
                RecommendationReason(
                    type="similar_bands_high",
                    label=f"Similar bands succeed here",
                    score=RecommendationService.SIMILAR_BANDS_HIGH_SCORE,
                ),
            )
        elif similar_count == 2:
            return (
                RecommendationService.SIMILAR_BANDS_MEDIUM_SCORE,
                RecommendationReason(
                    type="similar_bands_medium",
                    label="Similar bands accepted here",
                    score=RecommendationService.SIMILAR_BANDS_MEDIUM_SCORE,
                ),
            )
        elif similar_count == 1:
            return (
                RecommendationService.SIMILAR_BANDS_LOW_SCORE,
                RecommendationReason(
                    type="similar_bands_low",
                    label="A similar band was accepted",
                    score=RecommendationService.SIMILAR_BANDS_LOW_SCORE,
                ),
            )
        
        # Fallback: Check if same-genre bands have been accepted here
        genre_count = genre_bands_per_venue.get(venue_id, 0)
        if genre_count >= 2:
            return (
                RecommendationService.SIMILAR_GENRE_BANDS_SCORE,
                RecommendationReason(
                    type="similar_genre_bands",
                    label="Your genre succeeds here",
                    score=RecommendationService.SIMILAR_GENRE_BANDS_SCORE,
                ),
            )
        
        return 0.0, None

    @staticmethod
    def record_gig_view(
        db: Session,
        band_id: int,
        event_id: int,
    ) -> GigView:
        """
        Record that a band viewed a gig.
        """
        gig_view = GigView(
            band_id=band_id,
            event_id=event_id,
        )
        db.add(gig_view)
        db.commit()
        db.refresh(gig_view)
        return gig_view

    @staticmethod
    def get_band_view_count(
        db: Session,
        band_id: int,
        event_id: int,
    ) -> int:
        """
        Get how many times a band has viewed a specific event.
        """
        return (
            db.query(GigView)
            .filter(
                GigView.band_id == band_id,
                GigView.event_id == event_id,
            )
            .count()
        )

