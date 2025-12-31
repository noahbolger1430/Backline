from datetime import datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.venue_staff import VenueRole
from app.utils.validators import StringValidator


class VenueBase(BaseModel):
    """
    Base schema for venue with common attributes.
    """

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    street_address: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1)
    state: str = Field(..., min_length=1, max_length=2)
    zip_code: str = Field(..., min_length=1, max_length=6)
    capacity: Optional[int] = Field(None, gt=0)
    has_sound_provided: bool = False
    has_parking: bool = False
    age_restriction: Optional[int] = Field(None, ge=0, le=21)


    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return StringValidator.clean_and_validate(v, allow_none=False, error_msg="Venue name cannot be empty")

    @field_validator("street_address", "city")
    @classmethod
    def validate_address_fields(cls, v: str) -> str:
        return StringValidator.clean_and_validate(v, allow_none=False, error_msg="Address field cannot be empty")


class VenueCreate(VenueBase):
    """Schema for creating a venue."""

    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=20)


class VenueUpdate(BaseModel):
    """Schema for updating a venue. All fields optional."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    street_address: Optional[str] = Field(None, min_length=1)
    city: Optional[str] = Field(None, min_length=1)
    state: Optional[str] = Field(None, min_length=2, max_length=2)
    zip_code: Optional[str] = Field(None, min_length=1, max_length=6)
    capacity: Optional[int] = Field(None, gt=0)
    has_sound_provided: Optional[bool] = None
    has_parking: Optional[bool] = None
    age_restriction: Optional[int] = Field(None, ge=0, le=21)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=20)


    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True, error_msg="Venue name cannot be empty")

    @field_validator("street_address", "city")
    @classmethod
    def validate_address_fields(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True, error_msg="Address field cannot be empty")

    @field_validator("contact_name")
    @classmethod
    def validate_contact_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v == "":
                return None
        return v

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            # Remove common formatting characters for storage
            v = v.strip()
            if v == "":
                return None
        return v


class VenueInDB(VenueBase):
    """
    Schema representing venue as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    invite_code: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class Venue(VenueInDB):
    """
    Schema for venue responses with staff.
    """

    staff: List["VenueStaff"] = []


class VenueResponse(VenueBase):
    """Schema for venue API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    invite_code: str
    image_path: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    event_count: int = 0
    staff_count: int = 0
    is_favorited: Optional[bool] = None  # Only included when band_id is provided


class VenueListResponse(BaseModel):
    """Schema for paginated venue list responses."""

    venues: List[VenueResponse]
    total: int
    skip: int
    limit: int


class VenueStaffBase(BaseModel):
    """Base schema for venue staff association."""

    role: VenueRole = VenueRole.STAFF


class VenueStaffCreate(VenueStaffBase):
    """Schema for adding a staff member to a venue."""

    user_id: int


class VenueStaffUpdate(BaseModel):
    """Schema for updating staff member details."""

    role: Optional[VenueRole] = None


class VenueStaffResponse(VenueStaffBase):
    """Schema for venue staff API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    venue_id: int
    user_name: str
    user_email: str
    joined_at: datetime


class VenueJoinByInvite(BaseModel):
    """
    Schema for joining a venue with an invite code.
    """

    invite_code: str


class VenueOperatingHoursBase(BaseModel):
    """Base schema for venue operating hours."""

    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
    is_closed: bool = False
    open_time: Optional[time] = None
    close_time: Optional[time] = None


class VenueOperatingHoursUpdate(VenueOperatingHoursBase):
    """Schema for updating venue operating hours."""

    pass


class VenueOperatingHoursResponse(VenueOperatingHoursBase):
    """Schema for venue operating hours API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    created_at: datetime
    updated_at: datetime
