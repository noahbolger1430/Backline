from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_band_or_404, get_current_user, get_event_or_404
from app.database import get_db
from app.models import Band, Event, User
from app.schemas.recommendation import (
    GigViewCreate,
    GigViewResponse,
    RecommendedGigListResponse,
)
from app.services.recommendation_service import RecommendationService

router = APIRouter()


@router.get(
    "/bands/{band_id}/recommended-gigs",
    response_model=RecommendedGigListResponse,
    status_code=status.HTTP_200_OK,
)
def get_recommended_gigs(
    band_id: int,
    limit: int = Query(20, ge=1, le=100, description="Maximum number of recommendations"),
    include_applied: bool = Query(True, description="Include gigs already applied to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecommendedGigListResponse:
    """
    Get recommended gigs for a band.
    
    Returns a list of gigs sorted by recommendation score, with explanations
    for why each gig is recommended.
    
    The recommendation algorithm considers:
    - Band availability on the event date
    - Genre matching with venue's booking history
    - Past success or rejection at the venue
    - Event timing (sweet spot: 2-8 weeks out)
    - Competition level (number of current applicants)
    """
    band = get_band_or_404(band_id, db)
    
    # Verify user is a member of the band
    is_member = any(member.user_id == current_user.id for member in band.members)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this band to view recommendations",
        )
    
    recommended_gigs = RecommendationService.get_recommended_gigs(
        db=db,
        band=band,
        limit=limit,
        include_applied=include_applied,
    )
    
    return RecommendedGigListResponse(
        recommended_gigs=recommended_gigs,
        total_count=len(recommended_gigs),
    )


@router.post(
    "/bands/{band_id}/gig-views",
    response_model=GigViewResponse,
    status_code=status.HTTP_201_CREATED,
)
def record_gig_view(
    band_id: int,
    gig_view_data: GigViewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GigViewResponse:
    """
    Record that a band viewed a gig.
    
    This is used to track implicit interest signals for the recommendation system.
    """
    band = get_band_or_404(band_id, db)
    
    # Verify user is a member of the band
    is_member = any(member.user_id == current_user.id for member in band.members)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this band to record gig views",
        )
    
    # Verify event exists
    event = get_event_or_404(gig_view_data.event_id, db)
    
    gig_view = RecommendationService.record_gig_view(
        db=db,
        band_id=band_id,
        event_id=gig_view_data.event_id,
    )
    
    return GigViewResponse(
        id=gig_view.id,
        event_id=gig_view.event_id,
        band_id=gig_view.band_id,
        viewed_at=gig_view.viewed_at,
    )

