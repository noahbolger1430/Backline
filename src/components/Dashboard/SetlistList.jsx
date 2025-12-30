import React, { useState, useEffect } from "react";
import { setlistService } from "../../services/setlistService";
import "./SetlistList.css";

const SetlistList = ({ bandId, onBack, onSelect, onCreateNew }) => {
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchSetlists();
  }, [bandId]);

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

  const handleDelete = async (setlistId, setName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${setName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(setlistId);
      await setlistService.deleteSetlist(setlistId);
      setSetlists(setlists.filter(list => list.id !== setlistId));
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
            <button className="empty-state-button" onClick={onCreateNew}>
              Create Setlist
            </button>
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

