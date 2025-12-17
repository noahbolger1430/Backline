from datetime import date, datetime, time, timedelta
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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

    @field_validator("close_time")
    @classmethod
    def validate_close_after_open(cls, v: Optional[time], info) -> Optional[time]:
        if v is not None and "open_time" in info.data and info.data["open_time"] is not None:
            if v <= info.data["open_time"]:
                raise ValueError("close_time must be after open_time")
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
        if not v:
            raise ValueError("entries list cannot be empty")
        return v

    @field_validator("entries")
    @classmethod
    def validate_unique_days(cls, v: List[VenueOperatingHoursCreate]) -> List[VenueOperatingHoursCreate]:
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
    note: Optional[str] = Field(None, max_length=500)


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

    entries: List[VenueAvailabilityCreate] = Field(..., max_length=365)

    @field_validator("entries")
    @classmethod
    def validate_entries(cls, v: List[VenueAvailabilityCreate]) -> List[VenueAvailabilityCreate]:
        if not v:
            raise ValueError("entries list cannot be empty")
        if len(v) > 365:
            raise ValueError("Cannot create more than 365 entries at once")
        dates = [entry.date for entry in v]
        if len(dates) != len(set(dates)):
            raise ValueError("Duplicate dates found in entries")
        return v


class VenueAvailabilityBulkCreateByDayOfWeek(BaseModel):
    """
    Schema for creating availability entries for specific days of the week within a date range.
    """

    start_date: date
    end_date: date
    days_of_week: List[DayOfWeek] = Field(..., min_length=1, max_length=7)
    status: VenueAvailabilityStatus = VenueAvailabilityStatus.UNAVAILABLE
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("end_date")
    @classmethod
    def validate_date_range(cls, v: date, info) -> date:
        if "start_date" in info.data:
            if v < info.data["start_date"]:
                raise ValueError("end_date must be on or after start_date")
            if (v - info.data["start_date"]).days > 365:
                raise ValueError("Date range cannot exceed 365 days for bulk operations")
        max_future_date = date.today() + timedelta(days=730)
        if v > max_future_date:
            raise ValueError("Cannot set availability more than 2 years in the future")
        return v

    @field_validator("days_of_week")
    @classmethod
    def validate_unique_days(cls, v: List[DayOfWeek]) -> List[DayOfWeek]:
        if not v:
            raise ValueError("days_of_week list cannot be empty")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate days of week found")
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

