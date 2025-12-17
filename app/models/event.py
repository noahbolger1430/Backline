from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Event(Base):
    """
    Event model representing a scheduled show at a venue.

    Contains event details including date, time, and requirements.
    Bands can submit applications to perform at events and
    be booked through the band_events relationship.
    """

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_date = Column(Date, nullable=False, index=True)
    doors_time = Column(Time, nullable=True)
    show_time = Column(Time, nullable=False)
    is_ticketed = Column(Boolean, default=False, nullable=False)
    ticket_price = Column(Integer, nullable=True)
    is_age_restricted = Column(Boolean, default=False, nullable=False)
    age_restriction = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    venue = relationship("Venue", back_populates="events")
    applications = relationship("EventApplication", back_populates="event", cascade="all, delete-orphan")
    bands = relationship("BandEvent", back_populates="event", cascade="all, delete-orphan")

