import json
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Song(BaseModel):
    """
    Schema for a song with title and optional artist.
    """
    title: str = Field(..., min_length=1)
    artist: str = Field(default="", max_length=255)


class SetlistBase(BaseModel):
    """
    Base setlist schema with common attributes.
    """

    name: str = Field(..., min_length=1, max_length=255)
    songs: List[Song] = Field(..., min_items=1, max_items=50)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Setlist name cannot be empty or only whitespace")
        return cleaned

    @field_validator("songs")
    @classmethod
    def validate_songs(cls, v: List[Any]) -> List[Song]:
        if not v:
            raise ValueError("Setlist must contain at least 1 song")
        if len(v) > 50:
            raise ValueError("Setlist cannot contain more than 50 songs")
        
        # Convert to Song objects, handling both old (string) and new (object) formats
        cleaned = []
        for song in v:
            if isinstance(song, str):
                # Legacy format: just a string
                if song.strip():
                    cleaned.append(Song(title=song.strip(), artist=""))
            elif isinstance(song, dict):
                # New format: object with title and artist
                title = song.get("title", song.get("name", "")).strip()
                if title:
                    cleaned.append(Song(
                        title=title,
                        artist=song.get("artist", "").strip()
                    ))
            elif isinstance(song, Song):
                # Already a Song object
                if song.title.strip():
                    cleaned.append(song)
        
        if not cleaned:
            raise ValueError("Setlist must contain at least 1 non-empty song")
        return cleaned


class SetlistCreate(SetlistBase):
    """
    Schema for setlist creation.
    """

    band_id: int = Field(..., gt=0)


class SetlistUpdate(BaseModel):
    """
    Schema for updating setlist information.
    All fields are optional.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    songs: Optional[List[Song]] = Field(None, min_items=1, max_items=50)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Setlist name cannot be empty or only whitespace")
            return cleaned
        return v

    @field_validator("songs")
    @classmethod
    def validate_songs(cls, v: Optional[List[Any]]) -> Optional[List[Song]]:
        if v is not None:
            if not v:
                raise ValueError("Setlist must contain at least 1 song")
            if len(v) > 50:
                raise ValueError("Setlist cannot contain more than 50 songs")
            
            # Convert to Song objects, handling both old (string) and new (object) formats
            cleaned = []
            for song in v:
                if isinstance(song, str):
                    # Legacy format: just a string
                    if song.strip():
                        cleaned.append(Song(title=song.strip(), artist=""))
                elif isinstance(song, dict):
                    # New format: object with title and artist
                    title = song.get("title", song.get("name", "")).strip()
                    if title:
                        cleaned.append(Song(
                            title=title,
                            artist=song.get("artist", "").strip()
                        ))
                elif isinstance(song, Song):
                    # Already a Song object
                    if song.title.strip():
                        cleaned.append(song)
            
            if not cleaned:
                raise ValueError("Setlist must contain at least 1 non-empty song")
            return cleaned
        return v


class SetlistInDB(BaseModel):
    """
    Schema representing setlist as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    name: str
    songs_json: str
    created_at: datetime
    updated_at: datetime


class Setlist(SetlistBase):
    """
    Schema for setlist responses with parsed songs.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    songs: List[Song] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def parse_json_fields(cls, data: Any) -> Any:
        """
        Parse JSON string fields into Python objects.
        Converts songs from JSON to Song objects, handling both old (string) and new (object) formats.
        """
        if isinstance(data, dict):
            # Already a dict, check if songs_json needs parsing
            if "songs_json" in data and isinstance(data["songs_json"], str):
                try:
                    songs_data = json.loads(data["songs_json"])
                    # Convert to Song objects
                    songs = []
                    for song_data in songs_data:
                        if isinstance(song_data, str):
                            songs.append({"title": song_data, "artist": ""})
                        elif isinstance(song_data, dict):
                            songs.append({
                                "title": song_data.get("title", song_data.get("name", "")),
                                "artist": song_data.get("artist", "")
                            })
                    data["songs"] = songs
                except json.JSONDecodeError:
                    data["songs"] = []
            return data
        
        # If data is an ORM model
        if hasattr(data, "songs_json"):
            songs = []
            if data.songs_json:
                try:
                    songs_data = json.loads(data.songs_json)
                    # Convert to Song objects
                    for song_data in songs_data:
                        if isinstance(song_data, str):
                            songs.append({"title": song_data, "artist": ""})
                        elif isinstance(song_data, dict):
                            songs.append({
                                "title": song_data.get("title", song_data.get("name", "")),
                                "artist": song_data.get("artist", "")
                            })
                except json.JSONDecodeError:
                    songs = []
            
            return {
                "id": data.id,
                "band_id": data.band_id,
                "name": data.name,
                "songs": songs,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        
        return data


class SetlistSummary(BaseModel):
    """
    Schema for setlist summary in list responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    name: str
    song_count: int = 0
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def calculate_song_count(cls, data: Any) -> Any:
        """
        Calculate the number of songs in the setlist.
        """
        if isinstance(data, dict):
            if "songs_json" in data and isinstance(data["songs_json"], str):
                try:
                    songs = json.loads(data["songs_json"])
                    data["song_count"] = len(songs)
                except json.JSONDecodeError:
                    data["song_count"] = 0
            return data
        
        # If data is an ORM model
        if hasattr(data, "songs_json"):
            song_count = 0
            if data.songs_json:
                try:
                    songs = json.loads(data.songs_json)
                    song_count = len(songs)
                except json.JSONDecodeError:
                    song_count = 0
            
            return {
                "id": data.id,
                "band_id": data.band_id,
                "name": data.name,
                "song_count": song_count,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        
        return data

