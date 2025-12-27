from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class NotificationType(str, PyEnum):
    """
    Enumeration of notification types.
    """
    APPLICATION_STATUS = "application_status"
    BAND_APPLICATION = "band_application"
    GIG_AVAILABLE = "gig_available"


class Notification(Base):
    """
    Model representing a notification for a user.
    
    Notifications are created when events occur that the user should be aware of,
    such as application status changes.
    """
    
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)
    value = Column(String, nullable=False)  # e.g., "accepted", "rejected"
    venue_name = Column(String, nullable=False)
    gig_name = Column(String, nullable=False)
    gig_date = Column(DateTime(timezone=True), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Optional: Link to the event application that triggered this notification
    event_application_id = Column(Integer, ForeignKey("event_applications.id", ondelete="SET NULL"), nullable=True)
    
    user = relationship("User", back_populates="notifications")
    event_application = relationship("EventApplication", foreign_keys=[event_application_id])
    
    @hybrid_property
    def message(self) -> str:
        """Generate a human-readable notification message."""
        if self.type == NotificationType.BAND_APPLICATION.value:
            # Format: "[Band Name] applied to your event [Event Name] for [Event Date]."
            from datetime import datetime, date
            if isinstance(self.gig_date, datetime):
                date_str = self.gig_date.strftime("%B %d, %Y")
            elif isinstance(self.gig_date, date):
                date_str = self.gig_date.strftime("%B %d, %Y")
            else:
                # Try to parse if it's a string
                try:
                    parsed_date = datetime.fromisoformat(str(self.gig_date).replace('Z', '+00:00'))
                    date_str = parsed_date.strftime("%B %d, %Y")
                except:
                    date_str = str(self.gig_date)
            return f"{self.value} applied to your event {self.gig_name} for {date_str}."
        elif self.type == NotificationType.GIG_AVAILABLE.value:
            # Format: "[Event Name] at [Venue] is open for applications. Apply now!"
            return f"{self.gig_name} at {self.venue_name} is open for applications. Apply now!"
        else:
            # Application status notification
            status_text = self.value.capitalize()
            return f"Application to {self.gig_name} at {self.venue_name} has been {status_text}."

