import uuid

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Band(Base):
    """
    Band model representing a musical group.

    Contains band information and relationships to members,
    events they are booked for, and availability records.
    """

    __tablename__ = "bands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    genre = Column(String, nullable=True)
    location = Column(String, nullable=True)
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

    members = relationship("BandMember", back_populates="band", cascade="all, delete-orphan")
    events = relationship("BandEvent", back_populates="band", cascade="all, delete-orphan")
    availabilities = relationship("BandAvailability", back_populates="band", cascade="all, delete-orphan")
    event_applications = relationship("EventApplication", back_populates="band", cascade="all, delete-orphan")

