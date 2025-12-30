"""
YouTube API endpoints for searching songs and creating practice playlists.
"""
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_band_or_404, check_band_permission
from app.database import get_db
from app.models import User, BandRole
from app.services.youtube_service import youtube_service
from app.services.youtube_cache_service import YouTubeCacheService

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


class SetlistSearchRequest(BaseModel):
    """Request model for searching specific songs in a setlist."""
    songs_to_search: Optional[List[Dict[str, str]]] = None  # List of {title, artist, original_artist} objects


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
    request: Optional[SetlistSearchRequest] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> YouTubeSearchResponse:
    """
    Search for songs in a setlist on YouTube.
    If songs_to_search is provided, only search those songs. Otherwise, search all songs.
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
    
    # Parse all songs from setlist
    all_songs = json.loads(setlist.songs_json) if setlist.songs_json else []
    
    # If songs_to_search is provided, use those songs directly (already normalized by frontend)
    # The frontend sends songs with: title, artist (for search), original_artist (for cache key)
    if request and request.songs_to_search:
        songs = []
        for song_filter in request.songs_to_search:
            title = song_filter.get("title", "").strip()
            artist = song_filter.get("artist", "").strip()  # May be band name for "Original" songs
            original_artist = song_filter.get("original_artist", artist).strip()  # Original value
            songs.append({
                "title": title,
                "artist": artist,
                "original_artist": original_artist
            })
    else:
        # Search all songs from setlist
        songs = []
        for song in all_songs:
            if isinstance(song, dict):
                title = song.get("title", song.get("name", "")).strip()
                artist = song.get("artist", "").strip()
            else:
                title = str(song).strip()
                artist = ""
            songs.append({
                "title": title,
                "artist": artist,
                "original_artist": artist
            })
    
    # Check cache first - use original_artist for cache lookup
    # Build cache lookup songs with original_artist
    cache_lookup_songs = []
    for song in songs:
        cache_lookup_songs.append({
            "title": song.get("title", ""),
            "artist": song.get("original_artist", song.get("artist", ""))  # Use original artist for cache
        })
    
    cache_service = YouTubeCacheService()
    cached_results = cache_service.get_cached_results(db, setlist_id, cache_lookup_songs)
    
    # Prepare results list
    results = []
    songs_to_search = []
    
    # Process each song
    for song in songs:
        song_title = song.get("title", "").strip()
        song_artist = song.get("artist", "").strip()  # Artist used for YouTube search
        original_artist = song.get("original_artist", song_artist).strip()  # Original artist for cache
        
        # Cache key uses original_artist
        cache_key = (song_title, original_artist)
        
        # Check if cached
        if cache_key in cached_results:
            cached = cached_results[cache_key]
            # Use original_artist for display if it's "Original", otherwise use cached artist
            display_artist = original_artist if original_artist else cached["song_artist"]
            song_display_name = song_title
            if display_artist:
                song_display_name = f"{display_artist} - {song_title}"
            
            results.append(YouTubeVideoResult(
                song_name=song_display_name,
                song_title=cached["song_title"],
                song_artist=cached["song_artist"],
                video_id=cached["video_id"],
                title=cached["video_title"],
                channel_title=cached["channel_title"],
                thumbnail_url=cached["thumbnail_url"],
                found=cached["found"],
                error=cached.get("error")
            ))
        else:
            # Need to search for this song
            songs_to_search.append(song)
    
    # Search for songs not in cache
    if songs_to_search:
        if not youtube_service.is_configured:
            # No API configured, return error for uncached songs
            for song in songs_to_search:
                song_title = song.get("title", "").strip()
                song_artist = song.get("artist", "").strip()
                original_artist = song.get("original_artist", song_artist).strip()
                song_display_name = song_title
                if original_artist:
                    song_display_name = f"{original_artist} - {song_title}"
                results.append(YouTubeVideoResult(
                    song_name=song_display_name,
                    song_title=song_title,
                    song_artist=original_artist,
                    found=False,
                    error="YouTube API not configured"
                ))
        else:
            try:
                # Search YouTube for uncached songs
                search_results = await youtube_service.search_multiple_songs(
                    songs=songs_to_search,
                    band_name=band_name
                )
                
                # Create mapping of song title to original_artist for caching
                original_artist_map = {}
                for song in songs_to_search:
                    title = song.get("title", "").strip()
                    original_artist_map[title] = song.get("original_artist", song.get("artist", "")).strip()
                
                # Process search results and cache them
                for result in search_results:
                    song_title = result.get("song_title", "")
                    song_artist = result.get("song_artist", "")
                    # Get original_artist for caching
                    original_artist = original_artist_map.get(song_title, song_artist)
                    
                    # Cache the result with original_artist
                    cache_service.save_cache_result(
                        db=db,
                        setlist_id=setlist_id,
                        song_title=song_title,
                        song_artist=song_artist,
                        video_id=result.get("video_id"),
                        video_title=result.get("title"),
                        channel_title=result.get("channel_title"),
                        thumbnail_url=result.get("thumbnail_url"),
                        found=result.get("found", False),
                        error_message=result.get("error"),
                        original_artist=original_artist
                    )
                    
                    # Add to results - use original_artist for display
                    result_copy = dict(result)
                    result_copy["song_artist"] = original_artist
                    if original_artist:
                        result_copy["song_name"] = f"{original_artist} - {song_title}"
                    results.append(YouTubeVideoResult(**result_copy))
            except Exception as e:
                # If search fails, still return cached results and errors for uncached
                for song in songs_to_search:
                    song_title = song.get("title", "").strip()
                    song_artist = song.get("artist", "").strip()
                    original_artist = song.get("original_artist", song_artist).strip()
                    song_display_name = song_title
                    if original_artist:
                        song_display_name = f"{original_artist} - {song_title}"
                    results.append(YouTubeVideoResult(
                        song_name=song_display_name,
                        song_title=song_title,
                        song_artist=original_artist,
                        found=False,
                        error=f"Search failed: {str(e)}"
                    ))
    
    # Sort results to match original song order (using original_artist)
    song_order = {}
    for idx, song in enumerate(songs):
        title = song.get("title", "").strip()
        original_artist = song.get("original_artist", song.get("artist", "")).strip()
        song_order[(title, original_artist)] = idx
    
    results.sort(key=lambda r: song_order.get((r.song_title or "", r.song_artist or ""), 999))
    
    return YouTubeSearchResponse(
        results=results,
        api_configured=youtube_service.is_configured
    )

