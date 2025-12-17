from enum import Enum as PyEnum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class VenueAvailabilityStatus(str, PyEnum):
    """
    Enumeration of availability states for venue scheduling.
    """

    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    HOLD = "hold"


class VenueAvailability(Base):
    """
    Model representing explicit venue availability for a specific date.

    Used for venue-level scheduling blocks that apply regardless of
    operating hours (e.g., private events, renovations, holidays).

    A venue's effective availability for a date is determined by:
    1. If an Event exists on that date -> venue unavailable (booked)
    2. If VenueAvailability entry exists with UNAVAILABLE status -> venue unavailable
    3. If day of week is marked as closed in VenueOperatingHours -> venue unavailable
    4. Otherwise -> venue available
    """

    __tablename__ = "venue_availabilities"
    __table_args__ = (UniqueConstraint("venue_id", "date", name="unique_venue_date_availability"),)

    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String, nullable=False, default=VenueAvailabilityStatus.UNAVAILABLE.value)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    venue = relationship("Venue", back_populates="availabilities")

