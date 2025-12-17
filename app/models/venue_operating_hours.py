from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DayOfWeek(int, PyEnum):
    """
    Enumeration representing days of the week.
    Values align with Python's datetime.weekday() (Monday=0, Sunday=6).
    """

    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


class VenueOperatingHours(Base):
    """
    Model representing a venue's operating hours for a specific day of the week.

    Defines when a venue is open for business on each day.
    If is_closed is True, the venue does not operate on that day and
    is automatically considered unavailable for events.
    """

    __tablename__ = "venue_operating_hours"
    __table_args__ = (UniqueConstraint("venue_id", "day_of_week", name="unique_venue_day_of_week"),)

    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False, index=True)
    is_closed = Column(Boolean, default=False, nullable=False)
    open_time = Column(Time, nullable=True)
    close_time = Column(Time, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    venue = relationship("Venue", back_populates="operating_hours")

