import React, { useState, useEffect } from "react";
import { setlistService } from "../../services/setlistService";
import "./PracticeCompanion.css";

const PracticeCompanion = ({ bandId, onBack }) => {
  const [setlists, setSetlists] = useState([]);
  const [selectedSetlistId, setSelectedSetlistId] = useState("");
  const [selectedSetlist, setSelectedSetlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [practicedSongs, setPracticedSongs] = useState(new Set());

  useEffect(() => {
    fetchSetlists();
    loadPracticedSongs();
  }, [bandId]);

  // Load practiced songs from localStorage
  const loadPracticedSongs = () => {
    const key = `practiced_songs_${bandId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const practicedSet = new Set(JSON.parse(saved));
        setPracticedSongs(practicedSet);
      } catch (err) {
        console.error("Failed to load practiced songs:", err);
      }
    }
  };

  // Save practiced songs to localStorage
  const savePracticedSongs = (songSet) => {
    const key = `practiced_songs_${bandId}`;
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(songSet)));
    } catch (err) {
      console.error("Failed to save practiced songs:", err);
    }
  };

  const fetchSetlists = async () => {
    try {
      setLoading(true);
      const lists = await setlistService.getBandSetlists(bandId);
      setSetlists(lists);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch setlists:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetlistChange = async (e) => {
    const setlistId = e.target.value;
    setSelectedSetlistId(setlistId);

    if (setlistId) {
      try {
        const setlist = await setlistService.getSetlist(setlistId);
        setSelectedSetlist(setlist);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch setlist:", err);
        setError(err.message);
        setSelectedSetlist(null);
      }
    } else {
      setSelectedSetlist(null);
    }
  };

  const handleTogglePracticed = (song) => {
    const newPracticedSongs = new Set(practicedSongs);
    const songKey = `${selectedSetlistId}_${song}`;
    
    if (newPracticedSongs.has(songKey)) {
      newPracticedSongs.delete(songKey);
    } else {
      newPracticedSongs.add(songKey);
    }
    
    setPracticedSongs(newPracticedSongs);
    savePracticedSongs(newPracticedSongs);
  };

  // Sort songs: practiced songs go to the bottom
  const getSortedSongs = () => {
    if (!selectedSetlist || !selectedSetlist.songs) return [];
    
    const songKeyPrefix = `${selectedSetlistId}_`;
    const unpracticed = [];
    const practiced = [];
    
    selectedSetlist.songs.forEach((song) => {
      const songKey = `${songKeyPrefix}${song}`;
      if (practicedSongs.has(songKey)) {
        practiced.push(song);
      } else {
        unpracticed.push(song);
      }
    });
    
    return [...unpracticed, ...practiced];
  };

  if (loading) {
    return (
      <div className="practice-companion-container">
        <div className="practice-companion-loading">Loading setlists...</div>
      </div>
    );
  }

  return (
    <div className="practice-companion-container">
      <div className="practice-companion-header">
        <button className="practice-companion-back-button" onClick={onBack}>
          <span className="practice-companion-back-arrow">←</span>
          Back to Tools
        </button>
        <h2 className="practice-companion-title">Practice Companion</h2>
        <div style={{ width: "150px" }}></div>
      </div>

      <div className="practice-companion-content">
        {error && (
          <div className="practice-companion-error-message">{error}</div>
        )}

        <div className="setlist-selector-section">
          <label htmlFor="setlist-select" className="setlist-selector-label">
            Select a Setlist
          </label>
          <select
            id="setlist-select"
            value={selectedSetlistId}
            onChange={handleSetlistChange}
            className="setlist-selector"
          >
            <option value="">-- Choose a setlist --</option>
            {setlists.map((setlist) => (
              <option key={setlist.id} value={setlist.id}>
                {setlist.name} ({setlist.song_count} {setlist.song_count === 1 ? "song" : "songs"})
              </option>
            ))}
          </select>
        </div>

        {selectedSetlist && (
          <div className="songs-list-section">
            <h3 className="songs-list-title">{selectedSetlist.name}</h3>
            <div className="songs-list">
              {selectedSetlist.songs && selectedSetlist.songs.length > 0 ? (
                (() => {
                  const sortedSongs = getSortedSongs();
                  const songKeyPrefix = `${selectedSetlistId}_`;
                  
                  return sortedSongs.map((song, displayIndex) => {
                    const songKey = `${songKeyPrefix}${song}`;
                    const isPracticed = practicedSongs.has(songKey);
                    const originalIndex = selectedSetlist.songs.indexOf(song);
                    
                    return (
                      <div 
                        key={`${originalIndex}_${song}`} 
                        className={`song-item ${isPracticed ? 'practiced' : ''}`}
                      >
                        <div className="song-number">{originalIndex + 1}</div>
                        <div className={`song-name ${isPracticed ? 'practiced-name' : ''}`}>
                          {song}
                        </div>
                        <button
                          className={`practice-toggle-button ${isPracticed ? 'practiced' : ''}`}
                          onClick={() => handleTogglePracticed(song)}
                          title={isPracticed ? "Mark as needs practice" : "Mark as practiced"}
                        >
                          {isPracticed ? "✓" : "○"}
                        </button>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="no-songs-message">No songs in this setlist</div>
              )}
            </div>
          </div>
        )}

        {!selectedSetlistId && setlists.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🎸</div>
            <h3 className="empty-state-title">No Setlists Available</h3>
            <p className="empty-state-description">
              Create a setlist in the Setlist Builder to get started with practice
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeCompanion;

