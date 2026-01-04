"""
Tour Generator Schemas

Pydantic schemas for tour generation requests and responses.
"""

from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AlgorithmWeights(BaseModel):
    """
    Schema for algorithm weight configuration.
    
    All weights should be between 0.0 and 1.0, representing the relative
    importance of each factor in tour generation scoring.
    """
    
    genre_match_weight: float = Field(
        0.25,
        ge=0.0,
        le=1.0,
        description="Weight for genre matching importance"
    )
    capacity_match_weight: float = Field(
        0.15,
        ge=0.0,
        le=1.0,
        description="Weight for venue capacity matching"
    )
    distance_weight: float = Field(
        0.20,
        ge=0.0,
        le=1.0,
        description="Weight for minimizing travel distance"
    )
    weekend_preference_weight: float = Field(
        0.15,
        ge=0.0,
        le=1.0,
        description="Weight for weekend show preference"
    )
    recommendation_score_weight: float = Field(
        0.25,
        ge=0.0,
        le=1.0,
        description="Weight for collaborative filtering and past success"
    )


class TourGeneratorRequest(BaseModel):
    """
    Request schema for tour generation.
    """
    
    start_date: date = Field(..., description="Tour start date")
    end_date: date = Field(..., description="Tour end date")
    tour_radius_km: float = Field(
        ..., 
        gt=0, 
        le=8000,
        description="Maximum tour radius in kilometers"
    )
    starting_location: Optional[str] = Field(
        None,
        max_length=255,
        description="Starting city/state for the tour"
    )
    ending_location: Optional[str] = Field(
        None,
        max_length=255,
        description="Ending city/state for the tour"
    )
    min_days_between_shows: int = Field(
        0,
        ge=0,
        le=30,
        description="Minimum days between performances"
    )
    max_days_between_shows: int = Field(
        7,
        ge=1,
        le=30,
        description="Maximum days between performances"
    )
    max_drive_hours_per_day: float = Field(
        8.0,
        gt=0,
        le=24,
        description="Maximum driving hours per day"
    )
    preferred_genres: Optional[List[str]] = Field(
        None,
        max_length=10,
        description="List of preferred genres"
    )
    preferred_venue_capacity_min: Optional[int] = Field(
        None,
        ge=0,
        description="Minimum venue capacity"
    )
    preferred_venue_capacity_max: Optional[int] = Field(
        None,
        ge=0,
        description="Maximum venue capacity"
    )
    prioritize_weekends: bool = Field(
        True,
        description="Whether to prioritize weekend dates"
    )
    include_booked_events: bool = Field(
        False,
        description="Whether to include booked events in the tour"
    )
    avoid_venue_ids: Optional[List[int]] = Field(
        None,
        max_length=50,
        description="List of venue IDs to avoid"
    )
    algorithm_weights: Optional[AlgorithmWeights] = Field(
        None,
        description="Custom algorithm weights for tour generation scoring"
    )
    
    @field_validator("end_date")
    @classmethod
    def validate_date_range(cls, v: date, info) -> date:
        """
        Validate that end date is after start date.
        """
        if "start_date" in info.data and v <= info.data["start_date"]:
            raise ValueError("End date must be after start date")
        return v
    
    @field_validator("max_days_between_shows")
    @classmethod
    def validate_day_gaps(cls, v: int, info) -> int:
        """
        Validate that max days is greater than min days.
        """
        if "min_days_between_shows" in info.data and v <= info.data["min_days_between_shows"]:
            raise ValueError("Max days between shows must be greater than min days")
        return v
    
    @field_validator("preferred_venue_capacity_max")
    @classmethod
    def validate_capacity_range(cls, v: Optional[int], info) -> Optional[int]:
        """
        Validate that max capacity is greater than min capacity.
        """
        if v is not None and "preferred_venue_capacity_min" in info.data:
            min_cap = info.data["preferred_venue_capacity_min"]
            if min_cap is not None and v <= min_cap:
                raise ValueError("Max venue capacity must be greater than min capacity")
        return v


class TourEventRecommendation(BaseModel):
    """
    Schema for recommended event in tour.
    """
    
    event_id: int
    event_name: str
    event_date: str
    venue_id: int
    venue_name: str
    venue_location: str
    venue_capacity: Optional[int]
    distance_from_previous_km: float
    distance_from_home_km: float
    travel_days_needed: int
    tour_score: float
    recommendation_score: Optional[float]
    availability_status: str
    reasoning: List[str]
    is_open_for_applications: bool
    genre_tags: Optional[str]
    priority: str = Field(..., pattern="^(high|medium|low)$")
    image_path: Optional[str] = None


class TourVenueRecommendation(BaseModel):
    """
    Schema for recommended venue for direct booking.
    """
    
    venue_id: int
    venue_name: str
    suggested_date: str
    venue_location: str
    venue_capacity: Optional[int]
    venue_contact_name: Optional[str]
    venue_contact_email: Optional[str]
    venue_contact_phone: Optional[str]
    has_sound_provided: bool
    has_parking: bool
    distance_from_previous_km: float
    distance_from_home_km: float
    travel_days_needed: int
    score: float
    availability_status: str
    reasoning: List[str]
    booking_priority: str = Field(..., pattern="^(high|medium|low)$")
    day_of_week: str
    image_path: Optional[str] = None


class TourGeneratorResponse(BaseModel):
    """
    Response schema for tour generation.
    """
    
    band_id: int
    band_name: str
    tour_parameters: Dict
    recommended_events: List[TourEventRecommendation]
    recommended_venues: List[TourVenueRecommendation]
    tour_summary: Dict
    availability_conflicts: List[Dict]
    booked_events: List[Dict] = Field(default_factory=list, description="List of booked events (if any)")
    routing_warnings: List[str]


class SaveTourRequest(BaseModel):
    """
    Request schema for saving a generated tour.
    """
    
    name: str = Field(..., min_length=1, max_length=255, description="Name for the saved tour")


class SaveTourRequestWithData(BaseModel):
    """
    Combined request schema for saving a generated tour with tour data.
    """
    
    save_request: SaveTourRequest
    tour_data: TourGeneratorResponse


class SavedTourBase(BaseModel):
    """
    Base schema for saved tours.
    """
    
    name: str
    start_date: date
    end_date: date
    tour_radius_km: float
    starting_location: Optional[str]


class SavedTourInDB(SavedTourBase):
    """
    Schema for saved tour as stored in database.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    band_id: int
    tour_data: Dict
    tour_params: Dict
    created_at: datetime
    updated_at: datetime


class SavedTourSummary(SavedTourBase):
    """
    Summary schema for listing saved tours.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    total_shows: int
    total_distance_km: float


class SavedTourDetail(SavedTourInDB):
    """
    Detailed schema for retrieving a saved tour.
    """
    
    tour_results: TourGeneratorResponse

class VenueSwapDistanceRequest(BaseModel):
    """Request schema for calculating venue swap distances."""
    band_id: int
    new_venue_id: int
    suggested_date: date
    previous_stop_venue_id: Optional[int] = None
    previous_stop_date: Optional[date] = None
    next_stop_venue_id: Optional[int] = None
    next_stop_date: Optional[date] = None


class VenueSwapDistanceResponse(BaseModel):
    """Response schema for venue swap distance calculations."""
    distance_from_home_km: float
    distance_from_previous_km: float
    distance_to_next_km: float
    travel_days_needed: int
    routing_note: str