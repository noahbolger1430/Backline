from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.venue_staff import VenueRole


class VenueBase(BaseModel):
    """
    Base venue schema with common attributes.
    """

    name: str
    description: Optional[str] = None
    street_address: str
    city: str
    state: str
    zip_code: str
    capacity: Optional[int] = None
    has_sound_provided: bool = False
    has_parking: bool = False
    age_restriction: Optional[int] = None

    @field_validator("capacity")
    @classmethod
    def validate_capacity_positive(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate that capacity is positive if provided.
        """
        if v is not None and v <= 0:
            raise ValueError("capacity must be positive")
        return v

    @field_validator("age_restriction")
    @classmethod
    def validate_age_restriction(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate that age restriction is reasonable if provided.
        """
        if v is not None and (v < 0 or v > 21):
            raise ValueError("age_restriction must be between 0 and 21")
        return v


class VenueCreate(VenueBase):
    """
    Schema for venue creation.
    """

    pass


class VenueUpdate(BaseModel):
    """
    Schema for updating venue information.
    All fields are optional to allow partial updates.
    """

    name: Optional[str] = None
    description: Optional[str] = None
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    capacity: Optional[int] = None
    has_sound_provided: Optional[bool] = None
    has_parking: Optional[bool] = None
    age_restriction: Optional[int] = None

    @field_validator("capacity")
    @classmethod
    def validate_capacity_positive(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate that capacity is positive if provided.
        """
        if v is not None and v <= 0:
            raise ValueError("capacity must be positive")
        return v

    @field_validator("age_restriction")
    @classmethod
    def validate_age_restriction(cls, v: Optional[int]) -> Optional[int]:
        """
        Validate that age restriction is reasonable if provided.
        """
        if v is not None and (v < 0 or v > 21):
            raise ValueError("age_restriction must be between 0 and 21")
        return v


class VenueStaffBase(BaseModel):
    """
    Base schema for venue staff information.
    """

    user_id: int
    role: VenueRole


class VenueStaffInDB(VenueStaffBase):
    """
    Schema representing venue staff as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    joined_at: datetime


class VenueStaff(VenueStaffInDB):
    """
    Schema for venue staff responses.
    """

    pass


class VenueInDB(VenueBase):
    """
    Schema representing venue as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class Venue(VenueInDB):
    """
    Schema for venue responses with staff.
    """

    staff: List[VenueStaff] = []


class VenueStaffAdd(BaseModel):
    """
    Schema for adding a staff member to a venue.
    """

    user_id: int
    role: VenueRole = VenueRole.STAFF


class VenueStaffUpdate(BaseModel):
    """
    Schema for updating a venue staff member's information.
    """

    role: Optional[VenueRole] = None

