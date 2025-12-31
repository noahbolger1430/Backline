"""
Venue Recommendation Schemas

Pydantic schemas for band recommendations shown to venue owners.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class BandRecommendationReason(BaseModel):
    """
    Represents a single reason why a band was recommended.
    """

    type: str = Field(..., description="Type of recommendation reason")
    label: str = Field(..., description="Human-readable label for the reason")
    score: float = Field(..., description="Score contribution from this reason")


class RecommendedBand(BaseModel):
    """
    A band with recommendation details for venue owners.
    """

    model_config = ConfigDict(from_attributes=True)

    # Band details
    id: int
    name: str
    genre: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    image_path: Optional[str] = None
    
    # Social media
    spotify_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    website_url: Optional[str] = None

    # Recommendation details
    recommendation_score: float = Field(..., description="Overall recommendation score")
    recommendation_reasons: List[BandRecommendationReason] = Field(
        default_factory=list, description="List of reasons for this recommendation"
    )


class RecommendedBandListResponse(BaseModel):
    """
    Response containing a list of recommended bands.
    """

    recommended_bands: List[RecommendedBand]
    total_count: int


class ApplicantWithScore(BaseModel):
    """
    An event application with recommendation scoring for the band.
    """

    model_config = ConfigDict(from_attributes=True)

    # Application details
    application_id: int
    status: str
    message: Optional[str] = None
    response_note: Optional[str] = None
    applied_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by_name: Optional[str] = None

    # Band details
    band_id: int
    band_name: str
    band_genre: Optional[str] = None
    band_location: Optional[str] = None
    band_description: Optional[str] = None
    band_image_path: Optional[str] = None
    band_spotify_url: Optional[str] = None
    band_instagram_url: Optional[str] = None
    band_facebook_url: Optional[str] = None
    band_website_url: Optional[str] = None

    # Recommendation details
    recommendation_score: float = Field(..., description="Overall recommendation score")
    recommendation_reasons: List[BandRecommendationReason] = Field(
        default_factory=list, description="List of reasons for this recommendation"
    )
    
    # Match indicator
    is_top_match: bool = Field(
        False, description="Whether this is one of the top matching applicants"
    )


class ScoredApplicantsResponse(BaseModel):
    """
    Response containing scored applicants for an event.
    """

    applicants: List[ApplicantWithScore]
    total_count: int
    pending_count: int = Field(0, description="Number of pending applications")

