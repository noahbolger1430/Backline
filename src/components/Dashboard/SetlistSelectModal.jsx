import React, { useState, useEffect } from "react";
import { setlistService } from "../../services/setlistService";
import "./SetlistSelectModal.css";

const SetlistSelectModal = ({ bandId, onSelect, onClose }) => {
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSetlists = async () => {
      try {
        setLoading(true);
        setError(null);
        const lists = await setlistService.getBandSetlists(bandId);
        setSetlists(lists);
      } catch (err) {
        setError(err.message || "Failed to load setlists");
      } finally {
        setLoading(false);
      }
    };

    if (bandId) {
      fetchSetlists();
    }
  }, [bandId]);

  const handleSelect = (setlistId) => {
    if (onSelect) {
      onSelect(setlistId);
    }
    onClose();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content setlist-select-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <h2>Select Setlist</h2>

        {error && <div className="modal-error">{error}</div>}

        {loading ? (
          <div className="setlist-select-loading">Loading setlists...</div>
        ) : setlists.length === 0 ? (
          <div className="setlist-select-empty">
            <p>No setlists available. Create a setlist first.</p>
          </div>
        ) : (
          <div className="setlist-select-list">
            {setlists.map((setlist) => (
              <div
                key={setlist.id}
                className="setlist-select-item"
                onClick={() => handleSelect(setlist.id)}
              >
                <div className="setlist-select-item-header">
                  <h3>{setlist.name}</h3>
                  <button
                    className="setlist-select-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(setlist.id);
                    }}
                  >
                    Select
                  </button>
                </div>
                <div className="setlist-select-item-meta">
                  <span>🎵 {setlist.song_count} {setlist.song_count === 1 ? "song" : "songs"}</span>
                  <span>Updated {formatDate(setlist.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="modal-button cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetlistSelectModal;

