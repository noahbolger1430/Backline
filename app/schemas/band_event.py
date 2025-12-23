from datetime import datetime, time
from enum import Enum
from typing import Optional, TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, field_validator

if TYPE_CHECKING:
    from app.schemas.band import BandSummary
    from app.schemas.event import EventSummary


class BandEventStatus(str, Enum):
    """
    Enumeration of band event participation statuses.
    """

    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class BandEventBase(BaseModel):
    """
    Base schema for band-event relationship with common attributes.
    """

    status: BandEventStatus = BandEventStatus.PENDING
    set_time: Optional[time] = None
    set_length_minutes: Optional[int] = None
    performance_order: Optional[int] = None

    @field_validator("set_length_minutes")
    @classmethod
    def validate_set_length(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate set length is positive and reasonable.
        """
        if v is not None and (v <= 0 or v > 480):
            raise ValueError("set_length_minutes must be between 1 and 480")
        return v

    @field_validator("performance_order")
    @classmethod
    def validate_performance_order(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate performance order is positive.
        """
        if v is not None and v <= 0:
            raise ValueError("performance_order must be positive")
        return v


class BandEventCreate(BaseModel):
    """
    Schema for creating a band-event relationship.
    """

    band_id: int
    event_id: int
    status: str = "pending"
    set_time: Optional[time] = None
    set_length_minutes: Optional[int] = None
    performance_order: Optional[int] = None


class BandEventUpdate(BaseModel):
    """
    Schema for updating a band-event relationship.
    All fields are optional to allow partial updates.
    """

    status: Optional[str] = None
    set_time: Optional[time] = None
    set_length_minutes: Optional[int] = None
    performance_order: Optional[int] = None


class BandEventInDB(BandEventBase):
    """
    Schema representing band-event as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    event_id: int
    created_at: datetime
    updated_at: datetime


class BandEventResponse(BandEventInDB):
    """
    Schema for band-event API responses.
    """

    band_name: Optional[str] = None  # Added for display purposes


class BandEventWithDetails(BandEventInDB):
    """
    Schema for band-event with full band and event details.
    """

    band: "BandSummary"
    event: "EventSummary"
