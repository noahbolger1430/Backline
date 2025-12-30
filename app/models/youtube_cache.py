from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class YouTubeCache(Base):
    """
    Cache for YouTube video search results to avoid repeated API calls.
    
    Stores video information for songs in setlists so we don't need to
    search YouTube every time a user opens the practice companion.
    """

    __tablename__ = "youtube_cache"

    id = Column(Integer, primary_key=True, index=True)
    setlist_id = Column(Integer, ForeignKey("setlists.id", ondelete="CASCADE"), nullable=False, index=True)
    song_title = Column(String(255), nullable=False)
    song_artist = Column(String(255), nullable=False, default="")
    video_id = Column(String(50), nullable=True)  # YouTube video ID
    video_title = Column(String(500), nullable=True)  # YouTube video title
    channel_title = Column(String(255), nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    found = Column(Integer, nullable=False, default=0)  # 0 = not found, 1 = found
    error_message = Column(Text, nullable=True)  # Store error if search failed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Unique constraint: one cache entry per setlist + song combination
    __table_args__ = (
        UniqueConstraint('setlist_id', 'song_title', 'song_artist', name='uq_youtube_cache_setlist_song'),
    )

    setlist = relationship("Setlist", backref="youtube_cache_entries")

