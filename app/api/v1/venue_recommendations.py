"""
Venue Recommendations API

Endpoints for band recommendations for venue owners.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models import Event, User, Venue, VenueStaff
from app.schemas.venue_recommendation import (
    ApplicantWithScore,
    BandRecommendationReason,
    RecommendedBand,
    RecommendedBandListResponse,
    ScoredApplicantsResponse,
)
from app.services.venue_recommendation_service import VenueRecommendationService

router = APIRouter()


def verify_venue_staff(user_id: int, venue_id: int, db: Session) -> bool:
    """Check if user is staff at the venue."""
    staff = (
        db.query(VenueStaff)
        .filter(
            VenueStaff.user_id == user_id,
            VenueStaff.venue_id == venue_id,
        )
        .first()
    )
    return staff is not None


@router.get(
    "/venues/{venue_id}/events/{event_id}/recommended-bands",
    response_model=RecommendedBandListResponse,
    status_code=status.HTTP_200_OK,
)
def get_recommended_bands_for_event(
    venue_id: int,
    event_id: int,
    limit: int = Query(20, ge=1, le=50, description="Maximum number of recommendations"),
    search: Optional[str] = Query(None, description="Optional search term to filter bands"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecommendedBandListResponse:
    """
    Get recommended bands for an event.
    
    Returns bands scored and ranked by how well they fit the event,
    considering genre, location, activity level, and profile quality.
    
    Use this when searching for bands to add to an event.
    """
    # Verify user has access to this venue
    if not verify_venue_staff(current_user.id, venue_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be staff at this venue to view recommendations",
        )
    
    # Verify event exists and belongs to venue
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    if event.venue_id != venue_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Event does not belong to this venue",
        )
    
    # Get recommendations
    scored_bands = VenueRecommendationService.get_recommended_bands_for_event(
        db=db,
        event_id=event_id,
        venue_id=venue_id,
        limit=limit,
        search_term=search,
    )
    
    # Convert to response format
    recommended_bands = []
    for item in scored_bands:
        band = item["band"]
        recommended_bands.append(
            RecommendedBand(
                id=band.id,
                name=band.name,
                genre=band.genre,
                location=band.location,
                description=band.description,
                image_path=band.image_path,
                spotify_url=band.spotify_url,
                instagram_url=band.instagram_url,
                facebook_url=band.facebook_url,
                website_url=band.website_url,
                recommendation_score=item["score"],
                recommendation_reasons=[
                    BandRecommendationReason(**reason) for reason in item["reasons"]
                ],
            )
        )
    
    return RecommendedBandListResponse(
        recommended_bands=recommended_bands,
        total_count=len(recommended_bands),
    )


@router.get(
    "/venues/{venue_id}/events/{event_id}/scored-applicants",
    response_model=ScoredApplicantsResponse,
    status_code=status.HTTP_200_OK,
)
def get_scored_applicants_for_event(
    venue_id: int,
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScoredApplicantsResponse:
    """
    Get all applicants for an event with recommendation scores.
    
    Returns applications sorted by how well each band fits the event,
    helping venue owners prioritize which applications to review first.
    
    High-scoring applicants are marked as "top matches".
    """
    # Verify user has access to this venue
    if not verify_venue_staff(current_user.id, venue_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be staff at this venue to view applicants",
        )
    
    # Verify event exists and belongs to venue
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    if event.venue_id != venue_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Event does not belong to this venue",
        )
    
    # Get scored applicants
    scored_applicants = VenueRecommendationService.score_applicants_for_event(
        db=db,
        event_id=event_id,
    )
    
    # Determine top matches (top 3 or top 25%, whichever is smaller)
    top_match_count = min(3, max(1, len(scored_applicants) // 4))
    top_scores = set()
    if scored_applicants:
        sorted_scores = sorted(
            [a["score"] for a in scored_applicants], reverse=True
        )[:top_match_count]
        top_scores = set(sorted_scores)
    
    # Convert to response format
    applicants = []
    pending_count = 0
    
    for idx, item in enumerate(scored_applicants):
        application = item["application"]
        band = item["band"]
        
        if application.status == "pending":
            pending_count += 1
        
        # Mark as top match if in top scores and score is significant
        is_top_match = (
            idx < top_match_count and 
            item["score"] >= 30  # Minimum score threshold for "top match"
        )
        
        applicants.append(
            ApplicantWithScore(
                application_id=application.id,
                status=application.status,
                message=application.message,
                response_note=application.response_note,
                applied_at=application.applied_at,
                reviewed_at=application.reviewed_at,
                reviewed_by_name=(
                    application.reviewed_by.full_name 
                    if application.reviewed_by else None
                ),
                band_id=band.id,
                band_name=band.name,
                band_genre=band.genre,
                band_location=band.location,
                band_description=band.description,
                band_image_path=band.image_path,
                band_spotify_url=band.spotify_url,
                band_instagram_url=band.instagram_url,
                band_facebook_url=band.facebook_url,
                band_website_url=band.website_url,
                recommendation_score=item["score"],
                recommendation_reasons=[
                    BandRecommendationReason(**reason) for reason in item["reasons"]
                ],
                is_top_match=is_top_match,
            )
        )
    
    return ScoredApplicantsResponse(
        applicants=applicants,
        total_count=len(applicants),
        pending_count=pending_count,
    )

