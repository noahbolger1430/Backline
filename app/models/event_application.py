from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ApplicationStatus(str, PyEnum):
    """
    Enumeration of possible states for an event application.
    """

    PENDING = "pending"
    REVIEWED = "reviewed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class EventApplication(Base):
    """
    Model representing a band's application to perform at an event.

    Tracks application status, band information, and any additional details
    provided by the band or venue staff during the application process.
    """

    __tablename__ = "event_applications"
    __table_args__ = (UniqueConstraint("event_id", "band_id", name="unique_event_band_application"),)

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default=ApplicationStatus.PENDING.value, index=True)
    message = Column(Text, nullable=True)
    response_note = Column(Text, nullable=True)
    applied_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    event = relationship("Event", back_populates="applications")
    band = relationship("Band", back_populates="event_applications")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])

