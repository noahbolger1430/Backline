from enum import Enum as PyEnum
from datetime import datetime, time

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Time, Interval
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class RecurrenceFrequency(str, PyEnum):
    """
    Enumeration of recurrence frequencies for rehearsals.
    """
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class Rehearsal(Base):
    """
    Model representing a rehearsal schedule for a band.
    
    Supports recurring rehearsals with configurable frequency,
    start time, location, and duration.
    """

    __tablename__ = "rehearsals"

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Recurring schedule configuration
    is_recurring = Column(String, nullable=False, default="false")  # Store as string for compatibility
    recurrence_frequency = Column(String, nullable=True)  # daily, weekly, biweekly, monthly
    recurrence_start_date = Column(DateTime(timezone=True), nullable=True)  # When recurrence starts
    recurrence_end_date = Column(DateTime(timezone=True), nullable=True)  # When recurrence ends (optional)
    
    # Single rehearsal date (for non-recurring)
    rehearsal_date = Column(DateTime(timezone=True), nullable=True)
    
    # Rehearsal details
    start_time = Column(Time, nullable=False)  # Time of day (e.g., 19:00)
    location = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # Duration in minutes
    
    # Optional notes
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    band = relationship("Band", back_populates="rehearsals")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    attachments = relationship("RehearsalAttachment", back_populates="rehearsal", cascade="all, delete-orphan")
    instances = relationship("RehearsalInstance", back_populates="rehearsal", cascade="all, delete-orphan")


class RehearsalInstance(Base):
    """
    Model representing a specific instance of a recurring rehearsal.
    
    When a recurring rehearsal is created, individual instances
    are generated for each occurrence date.
    """

    __tablename__ = "rehearsal_instances"

    id = Column(Integer, primary_key=True, index=True)
    rehearsal_id = Column(Integer, ForeignKey("rehearsals.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Specific date and time for this instance
    instance_date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Copy of rehearsal details (for historical accuracy if rehearsal is modified)
    location = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    rehearsal = relationship("Rehearsal", back_populates="instances")
    attachments = relationship("RehearsalAttachment", back_populates="instance", cascade="all, delete-orphan")


class RehearsalAttachment(Base):
    """
    Model representing file attachments for rehearsals.
    
    Supports setlists, videos, demo tapes, and other files.
    Can be attached to either a rehearsal (all instances) or a specific instance.
    Can be either a file attachment (file_path set) or a setlist attachment (setlist_id set).
    """

    __tablename__ = "rehearsal_attachments"

    id = Column(Integer, primary_key=True, index=True)
    rehearsal_id = Column(Integer, ForeignKey("rehearsals.id", ondelete="CASCADE"), nullable=False, index=True)
    instance_id = Column(Integer, ForeignKey("rehearsal_instances.id", ondelete="CASCADE"), nullable=True, index=True)
    
    file_path = Column(String, nullable=True)  # Path to stored file (nullable for setlist attachments)
    file_name = Column(String, nullable=True)  # Original filename (nullable for setlist attachments)
    file_type = Column(String, nullable=True)  # MIME type or category (setlist, video, demo, etc.)
    file_size = Column(Integer, nullable=True)  # File size in bytes
    
    setlist_id = Column(Integer, ForeignKey("setlists.id", ondelete="CASCADE"), nullable=True, index=True)  # Link to setlist if this is a setlist attachment
    
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    rehearsal = relationship("Rehearsal", back_populates="attachments")
    instance = relationship("RehearsalInstance", back_populates="attachments")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_user_id])
    setlist = relationship("Setlist", foreign_keys=[setlist_id])

