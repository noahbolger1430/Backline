from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class NotificationBase(BaseModel):
    """
    Base notification schema with common attributes.
    """
    type: str
    value: str
    venue_name: str
    gig_name: str
    gig_date: datetime


class NotificationCreate(NotificationBase):
    """
    Schema for creating a notification.
    """
    user_id: int
    event_application_id: Optional[int] = None


class NotificationResponse(NotificationBase):
    """
    Schema for notification API responses.
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    is_read: bool
    created_at: datetime
    event_application_id: Optional[int] = None
    message: str  # Generated message


class NotificationListResponse(BaseModel):
    """
    Schema for paginated notification list responses.
    """
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class NotificationUpdate(BaseModel):
    """
    Schema for updating a notification (marking as read).
    """
    is_read: bool = True

