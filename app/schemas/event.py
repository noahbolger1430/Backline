from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional, TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.event_application import ApplicationStatus

if TYPE_CHECKING:
    from app.schemas.band_event import BandEventResponse


class EventBase(BaseModel):
    """
    Base event schema with common attributes.
    """

    name: str
    description: Optional[str] = None
    event_date: date
    doors_time: Optional[time] = None
    show_time: time
    is_ticketed: bool = False
    ticket_price: Optional[int] = None
    is_age_restricted: bool = False
    age_restriction: Optional[int] = None

    @field_validator("ticket_price")
    @classmethod
    def validate_ticket_price(cls, v: Optional[int], info) -> Optional[int]:
        """
        Validate ticket price is positive and required if event is ticketed.
        """
        if "is_ticketed" in info.data and info.data["is_ticketed"]:
            if v is None:
                raise ValueError("ticket_price is required when is_ticketed is True")
            if v <= 0:
                raise ValueError("ticket_price must be positive")
        return v

    @field_validator("age_restriction")
    @classmethod
    def validate_age_restriction(cls, v: Optional[int], info) -> Optional[int]:
        """
        Validate age restriction is reasonable and required if age restricted.
        """
        if "is_age_restricted" in info.data and info.data["is_age_restricted"]:
            if v is None:
                raise ValueError("age_restriction is required when is_age_restricted is True")
            if v < 0 or v > 21:
                raise ValueError("age_restriction must be between 0 and 21")
        return v


class EventCreate(EventBase):
    """
    Schema for event creation.
    """

    pass


class EventUpdate(BaseModel):
    """
    Schema for updating event information.
    All fields are optional to allow partial updates.
    """

    name: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[date] = None
    doors_time: Optional[time] = None
    show_time: Optional[time] = None
    is_ticketed: Optional[bool] = None
    ticket_price: Optional[int] = None
    is_age_restricted: Optional[bool] = None
    age_restriction: Optional[int] = None

    @field_validator("ticket_price")
    @classmethod
    def validate_ticket_price_positive(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate that ticket price is positive if provided.
        """
        if v is not None and v <= 0:
            raise ValueError("ticket_price must be positive")
        return v

    @field_validator("age_restriction")
    @classmethod
    def validate_age_restriction_range(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate that age restriction is reasonable if provided.
        """
        if v is not None and (v < 0 or v > 21):
            raise ValueError("age_restriction must be between 0 and 21")
        return v


class EventSummary(BaseModel):
    """
    Schema for event summary in nested responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    name: str
    event_date: date
    show_time: time


class EventInDB(EventBase):
    """
    Schema representing event as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    created_at: datetime
    updated_at: datetime


class Event(EventInDB):
    """
    Schema for event responses.
    """

    pass


class EventWithBands(Event):
    """
    Schema for event responses including booked bands.
    """

    bands: List["BandEventResponse"] = []


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

