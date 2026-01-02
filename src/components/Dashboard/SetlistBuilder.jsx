import React, { useState, useEffect } from "react";
import { setlistService } from "../../services/setlistService";
import "./SetlistBuilder.css";

const SetlistBuilder = ({ bandId, setlistId, onBack, onSave }) => {
  const [name, setName] = useState("");
  const [songs, setSongs] = useState([{ title: "", artist: "", duration: "" }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

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
            return { title: song, artist: "", duration: "" };
          } else if (song && typeof song === 'object') {
            // New format: object with title, artist, and duration
            // Convert duration from seconds to MM:SS format if it exists
            let durationStr = "";
            if (song.duration) {
              if (typeof song.duration === 'number') {
                const minutes = Math.floor(song.duration / 60);
                const seconds = song.duration % 60;
                durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
              } else {
                durationStr = song.duration.toString();
              }
            }
            return {
              title: song.title || song.name || "",
              artist: song.artist || "",
              duration: durationStr
            };
          }
          return { title: "", artist: "", duration: "" };
        });
        setSongs(normalizedSongs);
      } else {
        setSongs([{ title: "", artist: "", duration: "" }]);
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

  const handleSongDurationChange = (index, value) => {
    const newSongs = [...songs];
    newSongs[index] = { ...newSongs[index], duration: value };
    setSongs(newSongs);
  };

  // Convert MM:SS format to seconds
  const parseDuration = (durationStr) => {
    if (!durationStr || !durationStr.trim()) return null;
    
    // Handle MM:SS format
    const parts = durationStr.trim().split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return minutes * 60 + seconds;
      }
    }
    
    // Handle just seconds
    const seconds = parseInt(durationStr.trim(), 10);
    if (!isNaN(seconds)) {
      return seconds;
    }
    
    return null;
  };

  const handleAddSong = () => {
    if (songs.length < 50) {
      setSongs([...songs, { title: "", artist: "", duration: "" }]);
    }
  };

  const handleRemoveSong = (index) => {
    if (songs.length > 1) {
      const newSongs = songs.filter((_, i) => i !== index);
      setSongs(newSongs);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.outerHTML);
    e.target.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "";
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    const newSongs = [...songs];
    const draggedSong = newSongs[draggedIndex];
    
    // Remove the dragged item
    newSongs.splice(draggedIndex, 1);
    
    // Insert at new position
    newSongs.splice(dropIndex, 0, draggedSong);
    
    setSongs(newSongs);
    setDraggedIndex(null);
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
          artist: song.artist.trim(),
          duration: parseDuration(song.duration)
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
                <div
                  key={index}
                  className={`song-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                  draggable={!saving}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <div className="song-number">{index + 1}</div>
                  <div className="song-drag-handle">⋮⋮</div>
                  <div className="song-inputs" onDragStart={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={song.title}
                      onChange={(e) => handleSongTitleChange(index, e.target.value)}
                      placeholder={`Song ${index + 1} title`}
                      disabled={saving}
                      className="song-input song-title-input"
                      draggable="false"
                    />
                    <input
                      type="text"
                      value={song.artist || ""}
                      onChange={(e) => handleSongArtistChange(index, e.target.value)}
                      placeholder="Original"
                      disabled={saving}
                      className="song-input song-artist-input"
                      draggable="false"
                    />
                    <input
                      type="text"
                      value={song.duration}
                      onChange={(e) => handleSongDurationChange(index, e.target.value)}
                      placeholder="MM:SS"
                      disabled={saving}
                      className="song-input song-duration-input"
                      title="Duration in MM:SS format (e.g., 3:45)"
                      draggable="false"
                    />
                  </div>
                  <div className="song-actions">
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
