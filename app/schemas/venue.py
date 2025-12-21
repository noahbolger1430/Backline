from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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

    pass


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


    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True, error_msg="Venue name cannot be empty")

    @field_validator("street_address", "city")
    @classmethod
    def validate_address_fields(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True, error_msg="Address field cannot be empty")


class VenueInDB(VenueBase):
    """
    Schema representing venue as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    invite_code: str
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
    created_at: datetime
    updated_at: datetime
    event_count: int = 0
    staff_count: int = 0


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

