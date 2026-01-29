import React, { useState, useEffect } from "react";
import { setlistService } from "../../services/setlistService";
import "./SetlistList.css";

const SetlistList = ({ bandId, onBack, onSelect, onCreateNew }) => {
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [runtimes, setRuntimes] = useState({}); // { setlistId: runtime in seconds }

  useEffect(() => {
    fetchSetlists();
  }, [bandId]);

  const fetchSetlists = async () => {
    try {
      setLoading(true);
      const lists = await setlistService.getBandSetlists(bandId);
      setSetlists(lists);
      setError(null);
      
      // Fetch full setlist data to calculate runtimes
      const runtimePromises = lists.map(async (setlist) => {
        try {
          const fullSetlist = await setlistService.getSetlist(setlist.id);
          if (fullSetlist.songs && Array.isArray(fullSetlist.songs)) {
            const totalSeconds = fullSetlist.songs.reduce((total, song) => {
              if (song && typeof song === 'object' && song.duration) {
                const duration = typeof song.duration === 'number' 
                  ? song.duration 
                  : parseInt(song.duration, 10);
                return total + (isNaN(duration) ? 0 : duration);
              }
              return total;
            }, 0);
            // Only include runtime if it's greater than 0
            if (totalSeconds > 0) {
              return { id: setlist.id, runtime: totalSeconds };
            }
          }
          return null; // No valid runtime
        } catch (err) {
          console.error(`Failed to fetch setlist ${setlist.id} for runtime:`, err);
          return null; // No valid runtime
        }
      });
      
      const runtimeResults = await Promise.all(runtimePromises);
      const runtimeMap = {};
      runtimeResults.forEach((result) => {
        if (result && result.runtime > 0) {
          runtimeMap[result.id] = result.runtime;
        }
      });
      setRuntimes(runtimeMap);
    } catch (err) {
      console.error("Failed to fetch setlists:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (setlistId, setName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${setName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(setlistId);
      await setlistService.deleteSetlist(setlistId);
      setSetlists(setlists.filter(list => list.id !== setlistId));
      // Remove runtime from state
      const newRuntimes = { ...runtimes };
      delete newRuntimes[setlistId];
      setRuntimes(newRuntimes);
    } catch (err) {
      console.error("Failed to delete setlist:", err);
      alert(`Failed to delete setlist: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRuntime = (totalSeconds) => {
    if (!totalSeconds || totalSeconds === 0) return null;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="setlist-list-container">
        <div className="setlist-list-loading">Loading setlists...</div>
      </div>
    );
  }

  return (
    <div className="setlist-list-container">
      <div className="setlist-list-header">
        <button className="setlist-back-button" onClick={onBack}>
          <span className="setlist-back-arrow">←</span>
          Back to Tools
        </button>
        <h2 className="setlist-list-title">Setlists</h2>
        <button className="create-new-button" onClick={onCreateNew}>
          <span className="plus-icon">+</span>
          Create New
        </button>
      </div>

      <div className="setlist-list-content">
        {error && (
          <div className="setlist-error-message">{error}</div>
        )}

        {setlists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 className="empty-state-title">No Setlists Yet</h3>
            <p className="empty-state-description">
              Create your first setlist to organize your songs for performances
            </p>
          </div>
        ) : (
          <div className="setlist-grid">
            {setlists.map((setlist) => (
              <div key={setlist.id} className="setlist-card">
                <div className="setlist-card-header">
                  <h3 className="setlist-card-title">{setlist.name}</h3>
                  <button
                    className="setlist-delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(setlist.id, setlist.name);
                    }}
                    disabled={deletingId === setlist.id}
                    title="Delete setlist"
                  >
                    {deletingId === setlist.id ? "..." : "×"}
                  </button>
                </div>
                
                <div className="setlist-card-meta">
                  <span className="setlist-card-songs">
                    🎵 {setlist.song_count} {setlist.song_count === 1 ? "song" : "songs"}
                  </span>
                  {runtimes[setlist.id] && runtimes[setlist.id] > 0 && formatRuntime(runtimes[setlist.id]) && (
                    <span className="setlist-card-runtime">
                      ⏱️ {formatRuntime(runtimes[setlist.id])}
                    </span>
                  )}
                  <span className="setlist-card-date">
                    Updated {formatDate(setlist.updated_at)}
                  </span>
                </div>

                <button
                  className="setlist-card-button"
                  onClick={() => onSelect(setlist.id)}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SetlistList;

