from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RecommendationReason(BaseModel):
    """
    Represents a single reason why a gig was recommended.
    """

    type: str = Field(..., description="Type of recommendation reason")
    label: str = Field(..., description="Human-readable label for the reason")
    score: float = Field(..., description="Score contribution from this reason")


class RecommendedGig(BaseModel):
    """
    A gig with recommendation details.
    """

    model_config = ConfigDict(from_attributes=True)

    # Event details
    id: int
    name: str
    description: Optional[str] = None
    event_date: date
    doors_time: Optional[time] = None
    show_time: time
    is_ticketed: bool = False
    ticket_price: Optional[int] = None
    is_age_restricted: bool = False
    age_restriction: Optional[int] = None
    image_path: Optional[str] = None
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    genre_tags: Optional[str] = None

    # Venue details
    venue_id: int
    venue_name: str
    venue_city: Optional[str] = None
    venue_state: Optional[str] = None
    venue_image_path: Optional[str] = None

    # Recommendation details
    recommendation_score: float = Field(..., description="Overall recommendation score")
    recommendation_reasons: List[RecommendationReason] = Field(
        default_factory=list, description="List of reasons for this recommendation"
    )

    # Application status (if band has applied)
    has_applied: bool = False
    application_status: Optional[str] = None
    application_count: int = 0


class RecommendedGigListResponse(BaseModel):
    """
    Response containing a list of recommended gigs.
    """

    recommended_gigs: List[RecommendedGig]
    total_count: int


class GigViewCreate(BaseModel):
    """
    Schema for recording a gig view.
    """

    event_id: int


class GigViewResponse(BaseModel):
    """
    Response after recording a gig view.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    band_id: int
    viewed_at: datetime

