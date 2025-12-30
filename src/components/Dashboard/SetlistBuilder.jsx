import React, { useState, useEffect } from "react";
import { setlistService } from "../../services/setlistService";
import "./SetlistBuilder.css";

const SetlistBuilder = ({ bandId, setlistId, onBack, onSave }) => {
  const [name, setName] = useState("");
  const [songs, setSongs] = useState([{ title: "", artist: "" }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (setlistId) {
      fetchSetlist();
    }
  }, [setlistId]);

  const fetchSetlist = async () => {
    try {
      setLoading(true);
      const setlist = await setlistService.getSetlist(setlistId);
      setName(setlist.name);
      
      // Handle both old format (strings) and new format (objects)
      if (setlist.songs && setlist.songs.length > 0) {
        const normalizedSongs = setlist.songs.map(song => {
          if (typeof song === 'string') {
            // Old format: just a string
            return { title: song, artist: "" };
          } else if (song && typeof song === 'object') {
            // New format: object with title and artist
            return {
              title: song.title || song.name || "",
              artist: song.artist || ""
            };
          }
          return { title: "", artist: "" };
        });
        setSongs(normalizedSongs);
      } else {
        setSongs([{ title: "", artist: "" }]);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to fetch setlist:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleSongTitleChange = (index, value) => {
    const newSongs = [...songs];
    newSongs[index] = { ...newSongs[index], title: value };
    setSongs(newSongs);
  };

  const handleSongArtistChange = (index, value) => {
    const newSongs = [...songs];
    newSongs[index] = { ...newSongs[index], artist: value };
    setSongs(newSongs);
  };

  const handleAddSong = () => {
    if (songs.length < 50) {
      setSongs([...songs, { title: "", artist: "" }]);
    }
  };

  const handleRemoveSong = (index) => {
    if (songs.length > 1) {
      const newSongs = songs.filter((_, i) => i !== index);
      setSongs(newSongs);
    }
  };

  const handleMoveUp = (index) => {
    if (index > 0) {
      const newSongs = [...songs];
      [newSongs[index - 1], newSongs[index]] = [newSongs[index], newSongs[index - 1]];
      setSongs(newSongs);
    }
  };

  const handleMoveDown = (index) => {
    if (index < songs.length - 1) {
      const newSongs = [...songs];
      [newSongs[index], newSongs[index + 1]] = [newSongs[index + 1], newSongs[index]];
      setSongs(newSongs);
    }
  };

  const handleSave = async () => {
    setError(null);

    // Validate name
    if (!name.trim()) {
      setError("Setlist name is required");
      return;
    }

    // Filter out empty songs and validate
    const validSongs = songs.filter(song => song.title.trim());
    if (validSongs.length === 0) {
      setError("At least one song is required");
      return;
    }

    if (validSongs.length > 50) {
      setError("Setlist cannot contain more than 50 songs");
      return;
    }

    try {
      setSaving(true);
      const setlistData = {
        name: name.trim(),
        songs: validSongs.map(song => ({
          title: song.title.trim(),
          artist: song.artist.trim()
        })),
      };

      if (setlistId) {
        await setlistService.updateSetlist(setlistId, setlistData);
      } else {
        await setlistService.createSetlist({
          ...setlistData,
          band_id: bandId,
        });
      }

      if (onSave) {
        onSave();
      }
    } catch (err) {
      console.error("Failed to save setlist:", err);
      setError(err.message || "Failed to save setlist");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="setlist-builder-container">
        <div className="setlist-builder-loading">Loading setlist...</div>
      </div>
    );
  }

  const validSongsCount = songs.filter(s => s.title.trim()).length;

  return (
    <div className="setlist-builder-container">
      <div className="setlist-builder-header">
        <button className="setlist-back-button" onClick={onBack}>
          <span className="setlist-back-arrow">←</span>
          Back
        </button>
        <h2 className="setlist-builder-title">
          {setlistId ? "Edit Setlist" : "Create Setlist"}
        </h2>
        <div style={{ width: "100px" }}></div>
      </div>

      <div className="setlist-builder-content">
        {error && (
          <div className="setlist-error-message">{error}</div>
        )}

        <div className="setlist-form">
          <div className="setlist-form-group">
            <label htmlFor="setlist-name">Setlist Name *</label>
            <input
              type="text"
              id="setlist-name"
              value={name}
              onChange={handleNameChange}
              placeholder="Enter setlist name"
              disabled={saving}
              maxLength={255}
            />
          </div>

          <div className="songs-section">
            <div className="songs-header">
              <label>Songs ({validSongsCount}/50) *</label>
              {songs.length < 50 && (
                <button
                  type="button"
                  className="add-song-button"
                  onClick={handleAddSong}
                  disabled={saving}
                >
                  <span className="plus-icon">+</span>
                  Add Song
                </button>
              )}
            </div>

            <div className="songs-list">
              {songs.map((song, index) => (
                <div key={index} className="song-item">
                  <div className="song-number">{index + 1}</div>
                  <div className="song-inputs">
                    <input
                      type="text"
                      value={song.title}
                      onChange={(e) => handleSongTitleChange(index, e.target.value)}
                      placeholder={`Song ${index + 1} title`}
                      disabled={saving}
                      className="song-input song-title-input"
                    />
                    <input
                      type="text"
                      value={song.artist}
                      onChange={(e) => handleSongArtistChange(index, e.target.value)}
                      placeholder={`Artist (optional)`}
                      disabled={saving}
                      className="song-input song-artist-input"
                    />
                  </div>
                  <div className="song-actions">
                    <button
                      type="button"
                      className="song-action-button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || saving}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="song-action-button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === songs.length - 1 || saving}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="song-action-button delete"
                      onClick={() => handleRemoveSong(index)}
                      disabled={songs.length === 1 || saving}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="setlist-cancel-button"
              onClick={onBack}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="setlist-save-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Setlist"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetlistBuilder;
