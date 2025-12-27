from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Notification, User
from app.models.notification import NotificationType
from app.schemas.notification import NotificationCreate


class NotificationService:
    """
    Service for managing notifications.
    """
    
    @staticmethod
    def create_notification(db: Session, notification_data: NotificationCreate) -> Notification:
        """Create a new notification."""
        notification = Notification(
            user_id=notification_data.user_id,
            type=notification_data.type,
            value=notification_data.value,
            venue_name=notification_data.venue_name,
            gig_name=notification_data.gig_name,
            gig_date=notification_data.gig_date,
            event_application_id=notification_data.event_application_id,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification
    
    @staticmethod
    def get_user_notifications(
        db: Session, user_id: int, unread_only: bool = False, limit: int = 50
    ) -> Tuple[List[Notification], int]:
        """Get notifications for a user."""
        query = db.query(Notification).filter(Notification.user_id == user_id)
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        total = query.count()
        notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
        
        return notifications, total
    
    @staticmethod
    def get_unread_count(db: Session, user_id: int) -> int:
        """Get count of unread notifications for a user."""
        return db.query(func.count(Notification.id)).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).scalar() or 0
    
    @staticmethod
    def mark_as_read(db: Session, notification_id: int, user_id: int) -> Optional[Notification]:
        """Mark a notification as read."""
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            notification.is_read = True
            db.commit()
            db.refresh(notification)
        
        return notification
    
    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        """Mark all notifications as read for a user."""
        count = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True})
        db.commit()
        return count

