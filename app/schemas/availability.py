from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.availability import AvailabilityStatus


class BandMemberAvailabilityBase(BaseModel):
    """
    Base schema for band member availability with common attributes.
    """

    date: date
    status: AvailabilityStatus = AvailabilityStatus.UNAVAILABLE
    note: Optional[str] = None


class BandMemberAvailabilityCreate(BandMemberAvailabilityBase):
    """
    Schema for creating a band member availability entry.
    """

    pass


class BandMemberAvailabilityUpdate(BaseModel):
    """
    Schema for updating a band member availability entry.
    All fields are optional to allow partial updates.
    """

    status: Optional[AvailabilityStatus] = None
    note: Optional[str] = None


class BandMemberAvailabilityInDB(BandMemberAvailabilityBase):
    """
    Schema representing band member availability as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_member_id: int
    created_at: datetime
    updated_at: datetime


class BandMemberAvailabilityResponse(BandMemberAvailabilityInDB):
    """
    Schema for band member availability API responses.
    """

    pass


class BandAvailabilityBase(BaseModel):
    """
    Base schema for band availability with common attributes.
    """

    date: date
    status: AvailabilityStatus = AvailabilityStatus.UNAVAILABLE
    note: Optional[str] = None


class BandAvailabilityCreate(BandAvailabilityBase):
    """
    Schema for creating a band availability entry.
    """

    pass


class BandAvailabilityUpdate(BaseModel):
    """
    Schema for updating a band availability entry.
    All fields are optional to allow partial updates.
    """

    status: Optional[AvailabilityStatus] = None
    note: Optional[str] = None


class BandAvailabilityInDB(BandAvailabilityBase):
    """
    Schema representing band availability as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    band_event_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class BandAvailabilityResponse(BandAvailabilityInDB):
    """
    Schema for band availability API responses.
    """

    pass


class BandAvailabilityWithEvent(BandAvailabilityResponse):
    """
    Schema for band availability with event details.
    """

    from app.schemas.band_event import BandEventResponse

    band_event: Optional[BandEventResponse] = None


class BandMemberAvailabilityBulkCreate(BaseModel):
    """
    Schema for creating multiple band member availability entries at once.
    Useful for setting availability across a date range.
    """

    entries: List[BandMemberAvailabilityCreate]

    @field_validator("entries")
    @classmethod
    def validate_entries_not_empty(cls, v: List[BandMemberAvailabilityCreate]) -> List[BandMemberAvailabilityCreate]:
        """
        Validate that the entries list is not empty.
        """
        if not v:
            raise ValueError("entries list cannot be empty")
        return v


class BandAvailabilityBulkCreate(BaseModel):
    """
    Schema for creating multiple band availability entries at once.
    Useful for setting availability across a date range.
    """

    entries: List[BandAvailabilityCreate]

    @field_validator("entries")
    @classmethod
    def validate_entries_not_empty(cls, v: List[BandAvailabilityCreate]) -> List[BandAvailabilityCreate]:
        """
        Validate that the entries list is not empty.
        """
        if not v:
            raise ValueError("entries list cannot be empty")
        return v


class DateRange(BaseModel):
    """
    Schema for specifying a date range for availability queries.
    """

    start_date: date
    end_date: date

    @field_validator("end_date")
    @classmethod
    def validate_end_date_after_start(cls, v: date, info) -> date:
        """
        Validate that end_date is not before start_date.
        """
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("end_date must be on or after start_date")
        return v


class MemberAvailabilitySummary(BaseModel):
    """
    Schema summarizing a band member's availability status for a date.
    """

    member_id: int
    user_id: int
    member_name: str
    status: AvailabilityStatus
    note: Optional[str] = None


class BandEffectiveAvailability(BaseModel):
    """
    Schema representing the computed effective availability for a band on a date.

    Combines explicit band-level availability with aggregated member availability
    to determine if the band can perform on a specific date.
    """

    date: date
    is_available: bool
    has_explicit_band_block: bool
    band_block_note: Optional[str] = None
    band_event_id: Optional[int] = None
    total_members: int
    available_members: int
    unavailable_members: int
    tentative_members: int
    member_details: List[MemberAvailabilitySummary]


class BandEffectiveAvailabilityRange(BaseModel):
    """
    Schema for effective availability across a date range.
    """

    band_id: int
    band_name: str
    start_date: date
    end_date: date
    availability: List[BandEffectiveAvailability]

