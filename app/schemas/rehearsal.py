from datetime import datetime, time, date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.rehearsal import RecurrenceFrequency


class RehearsalBase(BaseModel):
    """Base schema for rehearsal data."""
    
    start_time: time = Field(..., description="Start time of the rehearsal (e.g., 19:00)")
    location: str = Field(..., min_length=1, max_length=255, description="Rehearsal location")
    duration_minutes: int = Field(..., gt=0, le=1440, description="Duration in minutes (max 24 hours)")
    notes: Optional[str] = Field(None, description="Optional notes about the rehearsal")


class RehearsalCreate(RehearsalBase):
    """Schema for creating a new rehearsal."""
    
    is_recurring: bool = Field(False, description="Whether this is a recurring rehearsal")
    recurrence_frequency: Optional[RecurrenceFrequency] = Field(None, description="Frequency of recurrence")
    recurrence_start_date: Optional[datetime] = Field(None, description="Start date for recurring rehearsals")
    recurrence_end_date: Optional[datetime] = Field(None, description="End date for recurring rehearsals (optional)")
    rehearsal_date: Optional[datetime] = Field(None, description="Date for single (non-recurring) rehearsal")


class RehearsalUpdate(BaseModel):
    """Schema for updating a rehearsal."""
    
    start_time: Optional[time] = None
    location: Optional[str] = Field(None, min_length=1, max_length=255)
    duration_minutes: Optional[int] = Field(None, gt=0, le=1440)
    notes: Optional[str] = None
    recurrence_end_date: Optional[datetime] = None


class RehearsalAttachmentBase(BaseModel):
    """Base schema for rehearsal attachment."""
    
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    setlist_id: Optional[int] = None


class RehearsalAttachmentCreate(RehearsalAttachmentBase):
    """Schema for creating a rehearsal attachment."""
    
    pass


class RehearsalAttachment(RehearsalAttachmentBase):
    """Schema for rehearsal attachment response."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    rehearsal_id: int
    file_path: Optional[str] = None
    uploaded_by_user_id: Optional[int] = None
    uploaded_at: datetime
    setlist_name: Optional[str] = None  # Name of attached setlist if setlist_id is set


class RehearsalInstanceBase(BaseModel):
    """Base schema for rehearsal instance."""
    
    instance_date: datetime
    location: str
    duration_minutes: int
    notes: Optional[str] = None


class RehearsalInstance(RehearsalInstanceBase):
    """Schema for rehearsal instance response."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    rehearsal_id: int
    created_at: datetime


class Rehearsal(RehearsalBase):
    """Schema for rehearsal response."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    band_id: int
    created_by_user_id: Optional[int] = None
    is_recurring: str
    recurrence_frequency: Optional[str] = None
    recurrence_start_date: Optional[datetime] = None
    recurrence_end_date: Optional[datetime] = None
    rehearsal_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    attachments: List[RehearsalAttachment] = []
    instances: List[RehearsalInstance] = []


class RehearsalWithInstances(Rehearsal):
    """Schema for rehearsal with all instances."""
    
    pass


class RehearsalInstanceUpdate(BaseModel):
    """Schema for updating a single rehearsal instance."""
    
    instance_date: Optional[datetime] = None
    location: Optional[str] = Field(None, min_length=1, max_length=255)
    duration_minutes: Optional[int] = Field(None, gt=0, le=1440)
    notes: Optional[str] = None


class RehearsalCalendarItem(BaseModel):
    """Schema for calendar display of rehearsal instances."""
    
    id: int
    instance_date: datetime
    start_time: time
    location: str
    duration_minutes: int
    notes: Optional[str] = None
    rehearsal_id: int
    is_recurring: bool

