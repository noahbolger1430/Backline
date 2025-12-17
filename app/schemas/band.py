import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.band_member import BandRole


class BandBase(BaseModel):
    """
    Base band schema with common attributes.
    """

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    genre: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def validate_band_name(cls, v: str) -> str:
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Band name cannot be empty or only whitespace")
        return cleaned

    @field_validator("genre")
    @classmethod
    def validate_genre(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Genre cannot be empty or only whitespace")
            if not re.match(r"^[a-zA-Z0-9\s\-/&]+$", cleaned):
                raise ValueError("Genre can only contain letters, numbers, spaces, hyphens, slashes, and ampersands")
            return cleaned
        return v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Location cannot be empty or only whitespace")
            return cleaned
        return v


class BandCreate(BandBase):
    """
    Schema for band creation.
    """

    pass


class BandUpdate(BaseModel):
    """
    Schema for updating band information.
    All fields are optional.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    genre: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, min_length=1, max_length=255)


class BandMemberBase(BaseModel):
    """
    Base schema for band member information.
    """

    user_id: int
    role: BandRole
    instrument: Optional[str] = Field(None, min_length=1, max_length=100)

    @field_validator("instrument")
    @classmethod
    def validate_instrument(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Instrument cannot be empty or only whitespace")
            if not re.match(r"^[a-zA-Z0-9\s\-/&,]+$", cleaned):
                raise ValueError(
                    "Instrument can only contain letters, numbers, spaces, hyphens, slashes, commas, and ampersands"
                )
            return cleaned
        return v


class BandMemberInDB(BandMemberBase):
    """
    Schema representing band member as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    joined_at: datetime


class BandMember(BandMemberInDB):
    """
    Schema for band member responses.
    """

    pass


class BandInDB(BandBase):
    """
    Schema representing band as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class Band(BandInDB):
    """
    Schema for band responses with members.
    """

    members: List[BandMember] = []


class BandSummary(BaseModel):
    """
    Schema for band summary in nested responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    genre: Optional[str] = None
    location: Optional[str] = None


class BandMemberAdd(BaseModel):
    """
    Schema for adding a member to a band.
    """

    user_id: int = Field(..., gt=0)
    role: BandRole = BandRole.MEMBER
    instrument: Optional[str] = Field(None, min_length=1, max_length=100)

    @field_validator("instrument")
    @classmethod
    def validate_instrument(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Instrument cannot be empty or only whitespace")
            if not re.match(r"^[a-zA-Z0-9\s\-/&,]+$", cleaned):
                raise ValueError(
                    "Instrument can only contain letters, numbers, spaces, hyphens, slashes, commas, and ampersands"
                )
            return cleaned
        return v


class BandMemberUpdate(BaseModel):
    """
    Schema for updating a band member's information.
    """

    role: Optional[BandRole] = None
    instrument: Optional[str] = Field(None, min_length=1, max_length=100)

    @field_validator("instrument")
    @classmethod
    def validate_instrument(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Instrument cannot be empty or only whitespace")
            if not re.match(r"^[a-zA-Z0-9\s\-/&,]+$", cleaned):
                raise ValueError(
                    "Instrument can only contain letters, numbers, spaces, hyphens, slashes, commas, and ampersands"
                )
            return cleaned
        return v

