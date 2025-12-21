from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    is_ticketed: bool = False
    ticket_price: Optional[int] = Field(None, ge=0)
    is_age_restricted: bool = False
    age_restriction: Optional[int] = Field(None, ge=0, le=100)

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
    is_ticketed: Optional[bool] = None
    ticket_price: Optional[int] = Field(None, ge=0)
    is_age_restricted: Optional[bool] = None
    age_restriction: Optional[int] = Field(None, ge=0, le=100)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)

    @field_validator("ticket_price")
    @classmethod
    def validate_ticket_price(cls, v: Optional[int]) -> Optional[int]:
        return PriceValidator.validate_positive_price(v)


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

