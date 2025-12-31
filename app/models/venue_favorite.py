from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class VenueFavorite(Base):
    """
    Model for tracking which venues a band has favorited.
    """

    __tablename__ = "venue_favorites"
    __table_args__ = (
        UniqueConstraint("band_id", "venue_id", name="unique_band_venue_favorite"),
    )

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    band = relationship("Band", backref="venue_favorites")
    venue = relationship("Venue", backref="favorites")

