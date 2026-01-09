from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class EventStatus(str, PyEnum):
    """
    Enumeration of possible states for an event.
    """

    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class Event(Base):
    """
    Event model representing a scheduled show at a venue or band-created event.

    Contains event details including date, time, and requirements.
    Bands can submit applications to perform at venue events and
    be booked through the band_events relationship.
    Band-created events don't require a venue.
    """

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=True, index=True)  # Made nullable for band events
    created_by_band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=True, index=True)  # New field for band-created events
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_date = Column(Date, nullable=False, index=True)
    doors_time = Column(Time, nullable=True)
    show_time = Column(Time, nullable=False)
    status = Column(String, nullable=False, default=EventStatus.CONFIRMED.value, index=True)
    is_open_for_applications = Column(Boolean, default=False, nullable=False)
    is_ticketed = Column(Boolean, default=False, nullable=False)
    ticket_price = Column(Integer, nullable=True)
    is_age_restricted = Column(Boolean, default=False, nullable=False)
    age_restriction = Column(Integer, nullable=True)
    image_path = Column(String, nullable=True)
    
    # Location details for band-created events (when no venue is specified)
    location_name = Column(String, nullable=True)
    street_address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    
    # Genre tags for recommendation matching (comma-separated, e.g., "rock,alternative,indie")
    genre_tags = Column(String, nullable=True)
    
    # Recurring event fields
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurring_day_of_week = Column(Integer, nullable=True)  # 0=Monday, 6=Sunday
    recurring_frequency = Column(String, nullable=True)  # 'weekly', 'bi_weekly', 'monthly'
    recurring_start_date = Column(Date, nullable=True)
    recurring_end_date = Column(Date, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    venue = relationship("Venue", back_populates="events")
    created_by_band = relationship("Band", back_populates="created_events", foreign_keys=[created_by_band_id])
    applications = relationship("EventApplication", back_populates="event", cascade="all, delete-orphan")
    bands = relationship("BandEvent", back_populates="event", cascade="all, delete-orphan")
    ticket_pool = relationship("PhysicalTicketPool", back_populates="event", uselist=False, cascade="all, delete-orphan")
