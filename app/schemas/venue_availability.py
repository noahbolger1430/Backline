from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.venue_availability import VenueAvailabilityStatus
from app.models.venue_operating_hours import DayOfWeek
from app.utils.validators import BulkOperationValidator, DateRangeValidator, StringValidator, TimeValidator


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
        if "is_closed" in info.data and not info.data["is_closed"] and v is None:
            raise ValueError("open_time is required when venue is not closed")
        return v

    @field_validator("close_time")
    @classmethod
    def validate_close_time(cls, v: Optional[time], info) -> Optional[time]:
        if "is_closed" in info.data and not info.data["is_closed"] and v is None:
            raise ValueError("close_time is required when venue is not closed")
        return TimeValidator.validate_time_order(info.data.get("open_time"), v, "open_time", "close_time")


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

    entries: List[VenueOperatingHoursCreate] = Field(..., min_length=1, max_length=7)

    @field_validator("entries")
    @classmethod
    def validate_entries(cls, v: List[VenueOperatingHoursCreate]) -> List[VenueOperatingHoursCreate]:
        if not v:
            raise ValueError("Entries list cannot be empty")
        days = [entry.day_of_week for entry in v]
        BulkOperationValidator.validate_unique_list(days, "days of week")
        return v


class VenueAvailabilityBase(BaseModel):
    """
    Base schema for venue availability with common attributes.
    """

    date: date
    status: VenueAvailabilityStatus = VenueAvailabilityStatus.UNAVAILABLE
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: date) -> date:
        return DateRangeValidator.validate_not_too_far_future(v)

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)


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
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)


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
    def validate_entries(cls, v: List) -> List:
        return BulkOperationValidator.validate_bulk_entries(v, "date")


class VenueAvailabilityBulkCreateByDayOfWeek(BaseModel):
    """
    Schema for creating availability entries for specific days of the week within a date range.
    """

    start_date: date
    end_date: date
    days_of_week: List[DayOfWeek] = Field(..., min_length=1, max_length=7)
    status: VenueAvailabilityStatus = VenueAvailabilityStatus.UNAVAILABLE
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v: date) -> date:
        return DateRangeValidator.validate_not_too_far_past(v)

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v: date, info) -> date:
        v = DateRangeValidator.validate_not_too_far_future(v)
        if "start_date" in info.data:
            DateRangeValidator.validate_date_range(info.data["start_date"], v, max_days=365)
        return v

    @field_validator("days_of_week")
    @classmethod
    def validate_days_of_week(cls, v: List[DayOfWeek]) -> List[DayOfWeek]:
        return BulkOperationValidator.validate_unique_list(v, "days of week")

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)


class VenueDateRange(BaseModel):
    """
    Schema for specifying a date range for venue availability queries.
    """

    start_date: date
    end_date: date

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v: date) -> date:
        return DateRangeValidator.validate_not_too_far_past(v)

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v: date, info) -> date:
        v = DateRangeValidator.validate_not_too_far_future(v)
        if "start_date" in info.data:
            DateRangeValidator.validate_date_range(info.data["start_date"], v)
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

