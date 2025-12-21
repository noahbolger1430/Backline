import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Venue(Base):
    """
    Venue model representing a physical location where shows can be performed.

    Contains venue information such as location details, capacity, and amenities.
    Users associated with a venue can manage events and review applications.
    """

    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    street_address = Column(String, nullable=False)
    city = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False)
    zip_code = Column(String, nullable=False)
    capacity = Column(Integer, nullable=True)
    has_sound_provided = Column(Boolean, default=False, nullable=False)
    has_parking = Column(Boolean, default=False, nullable=False)
    age_restriction = Column(Integer, nullable=True)
    invite_code = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
    )
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    staff = relationship("VenueStaff", back_populates="venue", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="venue", cascade="all, delete-orphan")
    operating_hours = relationship("VenueOperatingHours", back_populates="venue", cascade="all, delete-orphan")
    availabilities = relationship("VenueAvailability", back_populates="venue", cascade="all, delete-orphan")

    @hybrid_property
    def event_count(self) -> int:
        """Return number of events for this venue."""
        return len(self.events)

    @hybrid_property
    def staff_count(self) -> int:
        """Return number of staff for this venue."""
        return len(self.staff)

