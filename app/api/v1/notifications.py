from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models import Notification, User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    NotificationUpdate,
)
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of notifications to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    """
    Get notifications for the current user.
    """
    notifications, total = NotificationService.get_user_notifications(
        db, current_user.id, unread_only=unread_only, limit=limit
    )
    unread_count = NotificationService.get_unread_count(db, current_user.id)
    
    # Convert notifications to response format with message
    notification_responses = []
    for n in notifications:
        notification_dict = {
            "id": n.id,
            "user_id": n.user_id,
            "type": n.type,
            "value": n.value,
            "venue_name": n.venue_name,
            "gig_name": n.gig_name,
            "gig_date": n.gig_date,
            "is_read": n.is_read,
            "created_at": n.created_at,
            "event_application_id": n.event_application_id,
            "message": n.message,  # Use the hybrid property
        }
        notification_responses.append(NotificationResponse.model_validate(notification_dict))
    
    return NotificationListResponse(
        notifications=notification_responses,
        total=total,
        unread_count=unread_count,
    )


@router.get("/notifications/unread-count", response_model=dict)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Get the count of unread notifications for the current user.
    """
    count = NotificationService.get_unread_count(db, current_user.id)
    return {"unread_count": count}


@router.patch("/notifications/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: int,
    update_data: NotificationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationResponse:
    """
    Update a notification (e.g., mark as read).
    """
    notification = NotificationService.mark_as_read(db, notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    # Convert notification to response format with message
    notification_dict = {
        "id": notification.id,
        "user_id": notification.user_id,
        "type": notification.type,
        "value": notification.value,
        "venue_name": notification.venue_name,
        "gig_name": notification.gig_name,
        "gig_date": notification.gig_date,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
        "event_application_id": notification.event_application_id,
        "message": notification.message,
    }
    return NotificationResponse.model_validate(notification_dict)


@router.post("/notifications/mark-all-read", response_model=dict)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Mark all notifications as read for the current user.
    """
    count = NotificationService.mark_all_as_read(db, current_user.id)
    return {"marked_read": count}

