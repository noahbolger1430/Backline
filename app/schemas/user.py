from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    """
    Base user schema with common attributes.
    """

    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    """
    Schema for user creation with password.
    """

    password: str


class UserUpdate(BaseModel):
    """
    Schema for updating user information.
    All fields are optional.
    """

    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None


class UserInDB(UserBase):
    """
    Schema representing user as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class User(UserInDB):
    """
    Schema for user responses.
    """

    pass

