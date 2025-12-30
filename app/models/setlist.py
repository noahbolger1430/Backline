from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Setlist(Base):
    """
    Setlist model representing a band's song list for performances.

    Contains setlist information including name and ordered list of songs.
    Each band can have multiple setlists (e.g., for different shows or venues).
    """

    __tablename__ = "setlists"

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    # Store songs as JSON string (list of song names, 1-50 songs)
    songs_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    band = relationship("Band", back_populates="setlists")

