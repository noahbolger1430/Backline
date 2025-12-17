from enum import Enum as PyEnum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class AvailabilityStatus(str, PyEnum):
    """
    Enumeration of availability states for scheduling.
    """

    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    TENTATIVE = "tentative"


class BandMemberAvailability(Base):
    """
    Model representing a band member's availability for a specific date.

    Tracks when individual band members are available or unavailable.
    Each entry represents a single date with a specific availability status.
    The absence of an entry for a date implies default availability.
    """

    __tablename__ = "band_member_availabilities"
    __table_args__ = (UniqueConstraint("band_member_id", "date", name="unique_member_date_availability"),)

    id = Column(Integer, primary_key=True, index=True)
    band_member_id = Column(
        Integer, ForeignKey("band_members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = Column(Date, nullable=False, index=True)
    status = Column(String, nullable=False, default=AvailabilityStatus.UNAVAILABLE.value)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    band_member = relationship("BandMember", back_populates="availabilities")


class BandAvailability(Base):
    """
    Model representing explicit band-level availability for a specific date.

    This is separate from computed availability based on member availability.
    Used for band-level scheduling blocks that apply regardless of individual
    member availability (e.g., band hiatus, studio time, travel days).

    When a band is booked for an event, a BandAvailability record is created
    with the band_event_id set, marking the band as unavailable for that date.

    A band's effective availability for a date is determined by:
    1. BandAvailability entry with UNAVAILABLE status -> unavailable
    2. ALL band members have UNAVAILABLE status for date -> unavailable
    3. Otherwise -> available
    """

    __tablename__ = "band_availabilities"
    __table_args__ = (UniqueConstraint("band_id", "date", name="unique_band_date_availability"),)

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    band_event_id = Column(Integer, ForeignKey("band_events.id", ondelete="SET NULL"), nullable=True, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String, nullable=False, default=AvailabilityStatus.UNAVAILABLE.value)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    band = relationship("Band", back_populates="availabilities")
    band_event = relationship("BandEvent", back_populates="availability")

