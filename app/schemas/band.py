from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.band_member import BandRole


class BandBase(BaseModel):
    """
    Base band schema with common attributes.
    """

    name: str
    description: Optional[str] = None
    genre: Optional[str] = None
    location: Optional[str] = None


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

    name: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    location: Optional[str] = None


class BandMemberBase(BaseModel):
    """
    Base schema for band member information.
    """

    user_id: int
    role: BandRole
    instrument: Optional[str] = None


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


class BandMemberAdd(BaseModel):
    """
    Schema for adding a member to a band.
    """

    user_id: int
    role: BandRole = BandRole.MEMBER
    instrument: Optional[str] = None


class BandMemberUpdate(BaseModel):
    """
    Schema for updating a band member's information.
    """

    role: Optional[BandRole] = None
    instrument: Optional[str] = None

