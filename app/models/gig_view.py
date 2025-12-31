from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class GigView(Base):
    """
    Model tracking when a band views a gig (event).
    
    Used for recommendation system to track implicit interest signals.
    Each view is recorded with a timestamp, allowing analysis of
    viewing patterns and frequency.
    """

    __tablename__ = "gig_views"
    __table_args__ = (
        UniqueConstraint("event_id", "band_id", "viewed_at", name="unique_gig_view_timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    band_id = Column(
        Integer,
        ForeignKey("bands.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    viewed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    event = relationship("Event", backref="views")
    band = relationship("Band", backref="gig_views")

