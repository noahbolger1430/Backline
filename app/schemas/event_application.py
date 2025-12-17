from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.event_application import ApplicationStatus
from app.utils.validators import StringValidator


class EventApplicationBase(BaseModel):
    """
    Base event application schema with common attributes.
    """

    message: Optional[str] = Field(None, max_length=1000)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)


class EventApplicationCreate(EventApplicationBase):
    """
    Schema for creating an event application.
    """

    pass


class EventApplicationUpdate(BaseModel):
    """
    Schema for updating an event application by the band.
    """

    message: Optional[str] = Field(None, max_length=1000)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)


class EventApplicationReview(BaseModel):
    """
    Schema for venue staff to review and respond to an application.
    """

    status: ApplicationStatus
    response_note: Optional[str] = Field(None, max_length=1000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: ApplicationStatus) -> ApplicationStatus:
        if v in [ApplicationStatus.PENDING, ApplicationStatus.WITHDRAWN]:
            raise ValueError("Status must be reviewed, accepted, or rejected")
        return v

    @field_validator("response_note")
    @classmethod
    def validate_response_note(cls, v: Optional[str]) -> Optional[str]:
        return StringValidator.clean_and_validate(v, allow_none=True)


class EventApplicationResponse(EventApplicationBase):
    """
    Schema for event application API responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    event_name: str
    event_date: datetime
    band_id: int
    band_name: str
    status: ApplicationStatus
    response_note: Optional[str] = None
    applied_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by_user_id: Optional[int] = None
    reviewed_by_name: Optional[str] = None


class EventApplicationListResponse(BaseModel):
    """
    Schema for paginated event application list responses.
    """

    applications: List[EventApplicationResponse]
    total: int
    skip: int
    limit: int

