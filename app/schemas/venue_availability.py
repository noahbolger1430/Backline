from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.venue_availability import VenueAvailabilityStatus
from app.models.venue_operating_hours import DayOfWeek


class VenueOperatingHoursBase(BaseModel):
    """
    Base schema for venue operating hours with common attributes.
    """

    day_of_week: DayOfWeek
    is_closed: bool = False
    open_time: Optional[time] = None
    close_time: Optional[time] = None

    @field_validator("open_time")
    @classmethod
    def validate_open_time_required_if_not_closed(cls, v: Optional[time], info) -> Optional[time]:
        """
        Validate that open_time is provided if venue is not closed.
        """
        if "is_closed" in info.data and not info.data["is_closed"] and v is None:
            raise ValueError("open_time is required when venue is not closed")
        return v

    @field_validator("close_time")
    @classmethod
    def validate_close_time_required_if_not_closed(cls, v: Optional[time], info) -> Optional[time]:
        """
        Validate that close_time is provided if venue is not closed.
        """
        if "is_closed" in info.data and not info.data["is_closed"] and v is None:
            raise ValueError("close_time is required when venue is not closed")
        return v


class VenueOperatingHoursCreate(VenueOperatingHoursBase):
    """
    Schema for creating venue operating hours entry.
    """

    pass


class VenueOperatingHoursUpdate(BaseModel):
    """
    Schema for updating venue operating hours.
    All fields are optional to allow partial updates.
    """

    is_closed: Optional[bool] = None
    open_time: Optional[time] = None
    close_time: Optional[time] = None


class VenueOperatingHoursInDB(VenueOperatingHoursBase):
    """
    Schema representing venue operating hours as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    created_at: datetime
    updated_at: datetime


class VenueOperatingHoursResponse(VenueOperatingHoursInDB):
    """
    Schema for venue operating hours API responses.
    """

    pass


class VenueOperatingHoursBulkCreate(BaseModel):
    """
    Schema for creating operating hours for multiple days at once.
    Useful for initial venue setup.
    """

    entries: List[VenueOperatingHoursCreate]

    @field_validator("entries")
    @classmethod
    def validate_entries_not_empty(cls, v: List[VenueOperatingHoursCreate]) -> List[VenueOperatingHoursCreate]:
        """
        Validate that the entries list is not empty.
        """
        if not v:
            raise ValueError("entries list cannot be empty")
        return v

    @field_validator("entries")
    @classmethod
    def validate_unique_days(cls, v: List[VenueOperatingHoursCreate]) -> List[VenueOperatingHoursCreate]:
        """
        Validate that each day of week appears only once.
        """
        days = [entry.day_of_week for entry in v]
        if len(days) != len(set(days)):
            raise ValueError("each day_of_week must appear only once")
        return v


class VenueAvailabilityBase(BaseModel):
    """
    Base schema for venue availability with common attributes.
    """

    date: date
    status: VenueAvailabilityStatus = VenueAvailabilityStatus.UNAVAILABLE
    note: Optional[str] = None


class VenueAvailabilityCreate(VenueAvailabilityBase):
    """
    Schema for creating a venue availability entry.
    """

    pass


class VenueAvailabilityUpdate(BaseModel):
    """
    Schema for updating a venue availability entry.
    All fields are optional to allow partial updates.
    """

    status: Optional[VenueAvailabilityStatus] = None
    note: Optional[str] = None


class VenueAvailabilityInDB(VenueAvailabilityBase):
    """
    Schema representing venue availability as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    created_at: datetime
    updated_at: datetime


class VenueAvailabilityResponse(VenueAvailabilityInDB):
    """
    Schema for venue availability API responses.
    """

    pass


class VenueAvailabilityBulkCreate(BaseModel):
    """
    Schema for creating multiple venue availability entries at once.
    Useful for blocking out date ranges.
    """

    entries: List[VenueAvailabilityCreate]

    @field_validator("entries")
    @classmethod
    def validate_entries_not_empty(cls, v: List[VenueAvailabilityCreate]) -> List[VenueAvailabilityCreate]:
        """
        Validate that the entries list is not empty.
        """
        if not v:
            raise ValueError("entries list cannot be empty")
        return v


class VenueAvailabilityBulkCreateByDayOfWeek(BaseModel):
    """
    Schema for creating availability entries for specific days of the week
    within a date range. Enables bulk blocking of recurring days.
    """

    start_date: date
    end_date: date
    days_of_week: List[DayOfWeek]
    status: VenueAvailabilityStatus = VenueAvailabilityStatus.UNAVAILABLE
    note: Optional[str] = None

    @field_validator("end_date")
    @classmethod
    def validate_end_date_after_start(cls, v: date, info) -> date:
        """
        Validate that end_date is not before start_date.
        """
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("end_date must be on or after start_date")
        return v

    @field_validator("days_of_week")
    @classmethod
    def validate_days_not_empty(cls, v: List[DayOfWeek]) -> List[DayOfWeek]:
        """
        Validate that at least one day of week is specified.
        """
        if not v:
            raise ValueError("days_of_week list cannot be empty")
        return v


class VenueDateRange(BaseModel):
    """
    Schema for specifying a date range for venue availability queries.
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


class VenueEffectiveAvailability(BaseModel):
    """
    Schema representing the computed effective availability for a venue on a date.

    Combines operating hours, explicit availability blocks, and scheduled events
    to determine if the venue is available for booking.
    """

    date: date
    day_of_week: DayOfWeek
    is_available: bool
    reason: Optional[str] = None
    has_event: bool
    event_id: Optional[int] = None
    event_name: Optional[str] = None
    is_operating_day: bool
    has_explicit_block: bool
    explicit_block_note: Optional[str] = None
    operating_hours: Optional[VenueOperatingHoursResponse] = None


class VenueEffectiveAvailabilityRange(BaseModel):
    """
    Schema for effective availability across a date range.
    """

    venue_id: int
    venue_name: str
    start_date: date
    end_date: date
    availability: List[VenueEffectiveAvailability]


class VenueAvailableDates(BaseModel):
    """
    Schema for listing only available dates within a range.
    Useful for bands searching for open venue dates.
    """

    venue_id: int
    venue_name: str
    available_dates: List[date]

