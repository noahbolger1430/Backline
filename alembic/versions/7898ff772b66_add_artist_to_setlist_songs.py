"""add_artist_to_setlist_songs

Revision ID: 7898ff772b66
Revises: a1b2c3d4e5f6
Create Date: 2025-12-29 23:32:55.598576

"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '7898ff772b66'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Convert songs_json from array of strings to array of objects with title and artist."""
    connection = op.get_bind()
    
    # Get all setlists
    result = connection.execute(text("SELECT id, songs_json FROM setlists"))
    setlists = result.fetchall()
    
    for setlist_id, songs_json in setlists:
        if not songs_json:
            continue
            
        try:
            songs = json.loads(songs_json)
            
            # Check if already in new format (list of objects)
            if songs and isinstance(songs[0], dict):
                # Already migrated, skip
                continue
            
            # Convert from array of strings to array of objects
            new_songs = []
            for song in songs:
                if isinstance(song, str):
                    new_songs.append({
                        "title": song,
                        "artist": ""
                    })
                elif isinstance(song, dict):
                    # Already in object format, but ensure it has both fields
                    new_songs.append({
                        "title": song.get("title", song.get("name", "")),
                        "artist": song.get("artist", "")
                    })
                else:
                    # Fallback for unexpected types
                    new_songs.append({
                        "title": str(song),
                        "artist": ""
                    })
            
            # Update the setlist with new format
            new_songs_json = json.dumps(new_songs)
            connection.execute(
                text("UPDATE setlists SET songs_json = :songs_json WHERE id = :id"),
                {"songs_json": new_songs_json, "id": setlist_id}
            )
        except (json.JSONDecodeError, Exception) as e:
            # Skip invalid JSON or other errors
            print(f"Warning: Could not migrate setlist {setlist_id}: {e}")
            continue
    
    connection.commit()


def downgrade() -> None:
    """Downgrade schema: Convert songs_json from array of objects back to array of strings."""
    connection = op.get_bind()
    
    # Get all setlists
    result = connection.execute(text("SELECT id, songs_json FROM setlists"))
    setlists = result.fetchall()
    
    for setlist_id, songs_json in setlists:
        if not songs_json:
            continue
            
        try:
            songs = json.loads(songs_json)
            
            # Check if already in old format (list of strings)
            if songs and isinstance(songs[0], str):
                # Already downgraded, skip
                continue
            
            # Convert from array of objects to array of strings
            new_songs = []
            for song in songs:
                if isinstance(song, dict):
                    # Extract title, fallback to name or empty string
                    title = song.get("title", song.get("name", ""))
                    new_songs.append(title)
                elif isinstance(song, str):
                    # Already a string
                    new_songs.append(song)
                else:
                    # Fallback
                    new_songs.append(str(song))
            
            # Update the setlist with old format
            new_songs_json = json.dumps(new_songs)
            connection.execute(
                text("UPDATE setlists SET songs_json = :songs_json WHERE id = :id"),
                {"songs_json": new_songs_json, "id": setlist_id}
            )
        except (json.JSONDecodeError, Exception) as e:
            # Skip invalid JSON or other errors
            print(f"Warning: Could not downgrade setlist {setlist_id}: {e}")
            continue
    
    connection.commit()
