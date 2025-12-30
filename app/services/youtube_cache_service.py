"""
Service for caching YouTube video search results.
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.youtube_cache import YouTubeCache


class YouTubeCacheService:
    """Service for managing YouTube video cache."""
    
    @staticmethod
    def get_cached_results(
        db: Session,
        setlist_id: int,
        songs: List[Any]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get cached YouTube results for songs in a setlist.
        
        Args:
            db: Database session
            setlist_id: The setlist ID
            songs: List of song objects (dicts with title and artist) or strings
            
        Returns:
            Dictionary mapping (song_title, song_artist) to cached result
        """
        cache_dict = {}
        
        # Extract song titles and artists
        song_keys = []
        for song in songs:
            if isinstance(song, dict):
                title = song.get("title", song.get("name", "")).strip()
                artist = song.get("artist", "").strip()
            else:
                title = str(song).strip()
                artist = ""
            song_keys.append((title, artist))
        
        # Query cache for all songs
        for title, artist in song_keys:
            cache_entry = db.query(YouTubeCache).filter(
                YouTubeCache.setlist_id == setlist_id,
                YouTubeCache.song_title == title,
                YouTubeCache.song_artist == artist
            ).first()
            
            if cache_entry:
                cache_dict[(title, artist)] = {
                    "song_title": cache_entry.song_title,
                    "song_artist": cache_entry.song_artist,
                    "video_id": cache_entry.video_id,
                    "video_title": cache_entry.video_title,
                    "channel_title": cache_entry.channel_title,
                    "thumbnail_url": cache_entry.thumbnail_url,
                    "found": bool(cache_entry.found),
                    "error": cache_entry.error_message,
                }
        
        return cache_dict
    
    @staticmethod
    def save_cache_result(
        db: Session,
        setlist_id: int,
        song_title: str,
        song_artist: str,
        video_id: Optional[str] = None,
        video_title: Optional[str] = None,
        channel_title: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        found: bool = False,
        error_message: Optional[str] = None
    ) -> YouTubeCache:
        """
        Save or update a cached YouTube result.
        
        Args:
            db: Database session
            setlist_id: The setlist ID
            song_title: Song title
            song_artist: Song artist
            video_id: YouTube video ID
            video_title: YouTube video title
            channel_title: YouTube channel title
            thumbnail_url: Thumbnail URL
            found: Whether the video was found
            error_message: Error message if search failed
            
        Returns:
            The cache entry (created or updated)
        """
        # Normalize
        song_title = song_title.strip()
        song_artist = song_artist.strip() if song_artist else ""
        
        # Check if entry exists
        cache_entry = db.query(YouTubeCache).filter(
            YouTubeCache.setlist_id == setlist_id,
            YouTubeCache.song_title == song_title,
            YouTubeCache.song_artist == song_artist
        ).first()
        
        if cache_entry:
            # Update existing entry
            cache_entry.video_id = video_id
            cache_entry.video_title = video_title
            cache_entry.channel_title = channel_title
            cache_entry.thumbnail_url = thumbnail_url
            cache_entry.found = 1 if found else 0
            cache_entry.error_message = error_message
        else:
            # Create new entry
            cache_entry = YouTubeCache(
                setlist_id=setlist_id,
                song_title=song_title,
                song_artist=song_artist,
                video_id=video_id,
                video_title=video_title,
                channel_title=channel_title,
                thumbnail_url=thumbnail_url,
                found=1 if found else 0,
                error_message=error_message
            )
            db.add(cache_entry)
        
        db.commit()
        db.refresh(cache_entry)
        return cache_entry
    
    @staticmethod
    def clear_cache_for_setlist(db: Session, setlist_id: int) -> int:
        """
        Clear all cached results for a setlist.
        
        Args:
            db: Database session
            setlist_id: The setlist ID
            
        Returns:
            Number of entries deleted
        """
        count = db.query(YouTubeCache).filter(
            YouTubeCache.setlist_id == setlist_id
        ).delete()
        db.commit()
        return count

