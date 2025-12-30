"""
YouTube Data API v3 service for searching songs and creating playlists.
"""
import httpx
from typing import List, Optional, Any
from dataclasses import dataclass

from app.config import get_settings


@dataclass
class YouTubeVideo:
    """Represents a YouTube video search result."""
    video_id: str
    title: str
    channel_title: str
    thumbnail_url: str
    duration: Optional[str] = None


class YouTubeService:
    """Service for interacting with YouTube Data API v3."""
    
    BASE_URL = "https://www.googleapis.com/youtube/v3"
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.youtube_api_key
    
    @property
    def is_configured(self) -> bool:
        """Check if YouTube API is properly configured."""
        return bool(self.api_key)
    
    async def search_song(self, song_name: str, band_name: Optional[str] = None, max_results: int = 1) -> List[YouTubeVideo]:
        """
        Search for a song on YouTube.
        
        Args:
            song_name: The name of the song to search for
            band_name: Optional band/artist name (not used - searches by song title only)
            max_results: Maximum number of results to return
            
        Returns:
            List of YouTubeVideo objects
        """
        if not self.is_configured:
            raise ValueError("YouTube API key not configured. Please add YOUTUBE_API_KEY to your .env file.")
        
        # Build search query using song title and artist if provided
        if band_name and band_name.strip():
            # Use artist name if provided
            search_query = f"{band_name} {song_name} official audio"
        else:
            # Just use song title
            search_query = f"{song_name} official audio"
        
        params = {
            "part": "snippet",
            "q": search_query,
            "type": "video",
            "maxResults": max_results,
            "key": self.api_key,
            "videoCategoryId": "10",  # Music category
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.BASE_URL}/search", params=params)
            
            if response.status_code != 200:
                error_data = response.json()
                error_message = error_data.get("error", {}).get("message", "YouTube API request failed")
                raise Exception(f"YouTube API error: {error_message}")
            
            data = response.json()
            videos = []
            
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                video_id = item.get("id", {}).get("videoId")
                
                if video_id:
                    videos.append(YouTubeVideo(
                        video_id=video_id,
                        title=snippet.get("title", ""),
                        channel_title=snippet.get("channelTitle", ""),
                        thumbnail_url=snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
                    ))
            
            return videos
    
    async def search_multiple_songs(
        self, 
        songs: List[Any], 
        band_name: Optional[str] = None
    ) -> List[dict]:
        """
        Search for multiple songs and return their YouTube video IDs.
        
        Args:
            songs: List of song names (strings) or song objects (dicts with title and artist)
            band_name: Optional band/artist name (deprecated - use artist from song object)
            
        Returns:
            List of dicts containing song name and video info
        """
        results = []
        
        for song in songs:
            # Extract song title and artist
            if isinstance(song, dict):
                song_title = song.get("title", song.get("name", ""))
                song_artist = song.get("artist", "")  # Artist to use for search
                original_artist = song.get("original_artist", song_artist)  # Original artist value
                song_display_name = song_title
                display_artist = original_artist if original_artist else song_artist
                if display_artist:
                    song_display_name = f"{display_artist} - {song_title}"
            else:
                # Legacy format: just a string
                song_title = str(song)
                song_artist = ""
                original_artist = ""
                song_display_name = song_title
            
            try:
                # Use artist from song object if available, otherwise fall back to band_name
                # If artist is "Original", use band_name for the search
                if song_artist and song_artist.strip().lower() == "original":
                    artist_to_use = band_name
                else:
                    artist_to_use = song_artist if song_artist else band_name
                videos = await self.search_song(song_title, artist_to_use, max_results=1)
                if videos:
                    video = videos[0]
                    results.append({
                        "song_name": song_display_name,
                        "song_title": song_title,
                        "song_artist": song_artist,
                        "video_id": video.video_id,
                        "title": video.title,
                        "channel_title": video.channel_title,
                        "thumbnail_url": video.thumbnail_url,
                        "found": True,
                    })
                else:
                    results.append({
                        "song_name": song_display_name,
                        "song_title": song_title,
                        "song_artist": song_artist,
                        "video_id": None,
                        "title": None,
                        "channel_title": None,
                        "thumbnail_url": None,
                        "found": False,
                    })
            except Exception as e:
                results.append({
                    "song_name": song_display_name,
                    "song_title": song_title,
                    "song_artist": song_artist,
                    "video_id": None,
                    "title": None,
                    "channel_title": None,
                    "thumbnail_url": None,
                    "found": False,
                    "error": str(e),
                })
        
        return results


# Singleton instance
youtube_service = YouTubeService()

