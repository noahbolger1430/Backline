from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.event import EventStatus
from app.models.event_application import ApplicationStatus
from app.schemas.band_event import BandEventCreate, BandEventResponse, BandEventStatus, BandEventUpdate
from app.utils.validators import PriceValidator, StringValidator


class EventBase(BaseModel):
    """
    Base schema for event with common attributes.
    """

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    event_date: date
    doors_time: Optional[time] = None
    show_time: time
    status: EventStatus = EventStatus.CONFIRMED
    is_open_for_applications: bool = False
    is_ticketed: bool = False
    ticket_price: Optional[int] = Field(None, ge=0)
    is_age_restricted: bool = False
    age_restriction: Optional[int] = Field(None, ge=0, le=100)
    is_recurring: bool = False
    recurring_day_of_week: Optional[int] = Field(None, ge=0, le=6)  # 0=Monday, 6=Sunday
    recurring_frequency: Optional[str] = Field(None, pattern="^(weekly|bi_weekly|monthly)$")
    recurring_start_date: Optional[date] = None
    recurring_end_date: Optional[date] = None
    genre_tags: Optional[str] = Field(None, max_length=500, description="Comma-separated genre tags, e.g., 'rock,alternative,indie'")

    @field_validator("genre_tags")
    @classmethod
    def validate_genre_tags(cls, v: Optional[str]) -> Optional[str]:
        """
        Validate and clean genre tags.
        """
        if v is not None:
            # Clean up: strip whitespace, lowercase, remove empty tags
            tags = [tag.strip().lower() for tag in v.split(",") if tag.strip()]
            if not tags:
                return None
            return ",".join(tags)
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return StringValidator.clean_and_validate(v, allow_none=False, error_msg="Event name cannot be empty")

    @field_validator("ticket_price")
    @classmethod
    def validate_ticket_price(cls, v: Optional[int], info) -> Optional[int]:
        return PriceValidator.validate_price_required_if_ticketed(v, info.data.get("is_ticketed", False), "ticket_price")

    @field_validator("age_restriction")
    @classmethod
    def validate_age_restriction(cls, v: Optional[int], info) -> Optional[int]:
        """
        Validate age restriction is provided if event is age restricted.
        """
        if info.data.get("is_age_restricted") and v is None:
            raise ValueError("Age restriction required for age-restricted events")
        return v

    @field_validator("is_open_for_applications")
    @classmethod
    def validate_open_for_applications(cls, v: bool, info) -> bool:
        """
        Validate that only pending events can be open for applications.
        """
        status = info.data.get("status")
        if v and status:
            # Normalize status to string for comparison
            if isinstance(status, EventStatus):
                status_str = status.value
            else:
                status_str = str(status)
            
            # Only allow opening for applications if status is pending
            if status_str != EventStatus.PENDING.value:
                raise ValueError("Only pending events can be open for applications")
        return v

    @field_validator("recurring_end_date")
    @classmethod
    def validate_recurring_dates(cls, v: Optional[date], info) -> Optional[date]:
        """
        Validate recurring event dates and fields.
        """
        is_recurring = info.data.get("is_recurring", False)
        if is_recurring:
            recurring_start_date = info.data.get("recurring_start_date")
            recurring_day_of_week = info.data.get("recurring_day_of_week")
            recurring_frequency = info.data.get("recurring_frequency")
            
            if recurring_start_date is None:
                raise ValueError("recurring_start_date is required for recurring events")
            if v is None:
                raise ValueError("recurring_end_date is required for recurring events")
            if recurring_day_of_week is None:
                raise ValueError("recurring_day_of_week is required for recurring events")
            if recurring_frequency is None:
                raise ValueError("recurring_frequency is required for recurring events")
            if v < recurring_start_date:
                raise ValueError("recurring_end_date must be after recurring_start_date")
        return v


class EventCreate(EventBase):
    """
    Schema for creating an event.
    """

    venue_id: int


class EventUpdate(BaseModel):
    """
    Schema for updating an event.
    All fields are optional to allow partial updates.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    event_date: Optional[date] = None
    doors_time: Optional[time] = None
    show_time: Optional[time] = None
    status: Optional[EventStatus] = None
    is_open_for_applications: Optional[bool] = None
    is_ticketed: Optional[bool] = None
    ticket_price: Optional[int] = Field(None, ge=0)
    is_age_restricted: Optional[bool] = None
    age_restriction: Optional[int] = Field(None, ge=0, le=100)
    image_path: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurring_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    recurring_frequency: Optional[str] = Field(None, pattern="^(weekly|bi_weekly|monthly)$")
    recurring_start_date: Optional[date] = None
    recurring_end_date: Optional[date] = None
    genre_tags: Optional[str] = Field(None, max_length=500, description="Comma-separated genre tags")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)

    @field_validator("ticket_price")
    @classmethod
    def validate_ticket_price(cls, v: Optional[int]) -> Optional[int]:
        return PriceValidator.validate_positive_price(v)

    @field_validator("genre_tags")
    @classmethod
    def validate_genre_tags(cls, v: Optional[str]) -> Optional[str]:
        """
        Validate and clean genre tags.
        """
        if v is not None:
            # Clean up: strip whitespace, lowercase, remove empty tags
            tags = [tag.strip().lower() for tag in v.split(",") if tag.strip()]
            if not tags:
                return None
            return ",".join(tags)
        return v


class EventInDB(EventBase):
    """
    Schema representing event as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    created_at: datetime
    updated_at: datetime


class EventResponse(EventBase):
    """
    Schema for event API responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    venue_name: str
    image_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    band_count: int = 0
    is_recurring: bool = False
    recurring_day_of_week: Optional[int] = None
    recurring_frequency: Optional[str] = None
    recurring_start_date: Optional[date] = None
    recurring_end_date: Optional[date] = None


class EventListResponse(BaseModel):
    """
    Schema for paginated event list responses.
    """

    events: List[EventResponse]
    total: int
    skip: int
    limit: int


class EventApplicationBase(BaseModel):
    """
    Base event application schema with common attributes.
    """

    message: Optional[str] = None


class EventApplicationCreate(EventApplicationBase):
    """
    Schema for creating an event application.
    """

    pass


class EventApplicationUpdate(BaseModel):
    """
    Schema for updating an event application by the band.
    """

    message: Optional[str] = None


class EventApplicationReview(BaseModel):
    """
    Schema for venue staff to review and respond to an application.
    """

    status: ApplicationStatus
    response_note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status_not_pending(cls, v: ApplicationStatus) -> ApplicationStatus:
        """
        Validate that review status is not pending or withdrawn.
        """
        if v in [ApplicationStatus.PENDING, ApplicationStatus.WITHDRAWN]:
            raise ValueError("status must be reviewed, accepted, or rejected")
        return v


class EventApplicationInDB(EventApplicationBase):
    """
    Schema representing event application as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    band_id: int
    status: ApplicationStatus
    response_note: Optional[str] = None
    applied_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by_user_id: Optional[int] = None


class EventApplication(EventApplicationInDB):
    """
    Schema for event application responses.
    """

    pass


class EventSummary(BaseModel):
    """
    Schema for event summary in nested responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    event_date: date
    show_time: time
    venue_id: int
    venue_name: str


class EventWithBands(EventResponse):
    """
    Schema for event with associated bands.
    """

    bands: List[BandEventResponse] = []
