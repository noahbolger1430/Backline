from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class BandEvent(Base):
    """
    Association table between Band and Event models.

    Represents a band's participation in an event, including
    their performance details and booking status.
    """

    __tablename__ = "band_events"

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending", index=True)
    set_time = Column(Time, nullable=True)
    set_length_minutes = Column(Integer, nullable=True)
    performance_order = Column(Integer, nullable=True)
    load_in_time = Column(Time, nullable=True)
    sound_check_time = Column(Time, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    band = relationship("Band", back_populates="events")
    event = relationship("Event", back_populates="bands")
    availability = relationship("BandAvailability", back_populates="band_event", uselist=False)

    __table_args__ = (
        UniqueConstraint(
            "band_id",
            "event_id",
            name="uq_band_event",
        ),
    )

