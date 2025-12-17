import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    """
    Base user schema with common attributes.
    """

    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        """
        Validate full name contains only valid characters and proper spacing.
        """
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Full name cannot be empty or only whitespace")
        if not re.match(r"^[a-zA-Z\s\-'\.]+$", cleaned):
            raise ValueError("Full name can only contain letters, spaces, hyphens, apostrophes, and periods")
        return cleaned


class UserCreate(UserBase):
    """
    Schema for user creation with password.
    """

    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validate password meets basic strength requirements.
        """
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserUpdate(BaseModel):
    """
    Schema for updating user information.
    All fields are optional.
    """

    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    password: Optional[str] = Field(None, min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Full name cannot be empty or only whitespace")
            if not re.match(r"^[a-zA-Z\s\-'\.]+$", cleaned):
                raise ValueError("Full name can only contain letters, spaces, hyphens, apostrophes, and periods")
            return cleaned
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not re.search(r"[A-Z]", v):
                raise ValueError("Password must contain at least one uppercase letter")
            if not re.search(r"[a-z]", v):
                raise ValueError("Password must contain at least one lowercase letter")
            if not re.search(r"\d", v):
                raise ValueError("Password must contain at least one digit")
            if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
                raise ValueError("Password must contain at least one special character")
        return v


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

