"""
YouTube API endpoints for searching songs and creating practice playlists.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_band_or_404, check_band_permission
from app.database import get_db
from app.models import User, BandRole
from app.services.youtube_service import youtube_service

router = APIRouter()


class YouTubeSearchRequest(BaseModel):
    """Request model for searching songs on YouTube."""
    songs: List[str]
    band_name: Optional[str] = None


class YouTubeVideoResult(BaseModel):
    """Response model for a YouTube video search result."""
    song_name: str
    song_title: Optional[str] = None
    song_artist: Optional[str] = None
    video_id: Optional[str] = None
    title: Optional[str] = None
    channel_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    found: bool
    error: Optional[str] = None


class YouTubeSearchResponse(BaseModel):
    """Response model for YouTube search."""
    results: List[YouTubeVideoResult]
    api_configured: bool


class YouTubeStatusResponse(BaseModel):
    """Response model for YouTube API status check."""
    configured: bool
    message: str


@router.get("/status", response_model=YouTubeStatusResponse)
async def get_youtube_status(
    current_user: User = Depends(get_current_active_user),
) -> YouTubeStatusResponse:
    """
    Check if YouTube API is configured.
    """
    if youtube_service.is_configured:
        return YouTubeStatusResponse(
            configured=True,
            message="YouTube API is configured and ready to use."
        )
    else:
        return YouTubeStatusResponse(
            configured=False,
            message="YouTube API key not configured. Please add YOUTUBE_API_KEY to your .env file."
        )


@router.post("/search", response_model=YouTubeSearchResponse)
async def search_songs(
    request: YouTubeSearchRequest,
    current_user: User = Depends(get_current_active_user),
) -> YouTubeSearchResponse:
    """
    Search for songs on YouTube.
    Returns video IDs for each song that can be used to create a playlist.
    """
    if not youtube_service.is_configured:
        return YouTubeSearchResponse(
            results=[
                YouTubeVideoResult(
                    song_name=song,
                    found=False,
                    error="YouTube API not configured"
                )
                for song in request.songs
            ],
            api_configured=False
        )
    
    try:
        results = await youtube_service.search_multiple_songs(
            songs=request.songs,
            band_name=request.band_name
        )
        
        return YouTubeSearchResponse(
            results=[YouTubeVideoResult(**r) for r in results],
            api_configured=True
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search YouTube: {str(e)}"
        )


@router.post("/search/setlist/{setlist_id}", response_model=YouTubeSearchResponse)
async def search_setlist_songs(
    setlist_id: int,
    band_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> YouTubeSearchResponse:
    """
    Search for all songs in a setlist on YouTube.
    Returns video IDs for each song that can be used to create a playlist.
    """
    import json
    from app.models.setlist import Setlist as SetlistModel
    
    # Get setlist
    setlist = db.query(SetlistModel).filter(SetlistModel.id == setlist_id).first()
    if not setlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setlist not found"
        )
    
    # Check permission
    band = get_band_or_404(setlist.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    # Get band name if not provided
    if not band_name:
        band_name = band.name
    
    # Parse songs
    songs = json.loads(setlist.songs_json) if setlist.songs_json else []
    
    if not youtube_service.is_configured:
        # Handle both old (string) and new (object) song formats
        results = []
        for song in songs:
            if isinstance(song, dict):
                song_title = song.get("title", song.get("name", ""))
                song_artist = song.get("artist", "")
                song_display_name = song_title
                if song_artist:
                    song_display_name = f"{song_artist} - {song_title}"
                results.append(YouTubeVideoResult(
                    song_name=song_display_name,
                    song_title=song_title,
                    song_artist=song_artist,
                    found=False,
                    error="YouTube API not configured"
                ))
            else:
                results.append(YouTubeVideoResult(
                    song_name=str(song),
                    song_title=str(song),
                    song_artist="",
                    found=False,
                    error="YouTube API not configured"
                ))
        return YouTubeSearchResponse(
            results=results,
            api_configured=False
        )
    
    try:
        results = await youtube_service.search_multiple_songs(
            songs=songs,
            band_name=band_name
        )
        
        return YouTubeSearchResponse(
            results=[YouTubeVideoResult(**r) for r in results],
            api_configured=True
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search YouTube: {str(e)}"
        )

