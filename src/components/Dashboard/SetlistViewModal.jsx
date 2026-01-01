import React, { useState, useEffect } from "react";
import { setlistService } from "../../services/setlistService";
import "./SetlistViewModal.css";

const SetlistViewModal = ({ setlistId, onClose }) => {
  const [setlist, setSetlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSetlist = async () => {
      if (!setlistId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await setlistService.getSetlist(setlistId);
        setSetlist(data);
      } catch (err) {
        setError(err.message || "Failed to load setlist");
      } finally {
        setLoading(false);
      }
    };

    fetchSetlist();
  }, [setlistId]);

  const formatDuration = (seconds) => {
    if (!seconds) return "";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const calculateTotalDuration = () => {
    if (!setlist?.songs) return 0;
    return setlist.songs.reduce((total, song) => {
      if (song && typeof song === "object" && song.duration) {
        return total + (song.duration || 0);
      }
      return total;
    }, 0);
  };

  const totalDuration = calculateTotalDuration();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content setlist-view-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        {loading ? (
          <div className="setlist-view-loading">Loading setlist...</div>
        ) : error ? (
          <div className="setlist-view-error">{error}</div>
        ) : setlist ? (
          <>
            <div className="setlist-view-header">
              <h2>{setlist.name}</h2>
              {totalDuration > 0 && (
                <div className="setlist-view-duration">
                  ⏱️ Total: {formatDuration(totalDuration)}
                </div>
              )}
            </div>

            <div className="setlist-view-content">
              {setlist.songs && setlist.songs.length > 0 ? (
                <div className="setlist-view-songs">
                  {setlist.songs.map((song, index) => {
                    // Handle both old format (strings) and new format (objects)
                    const songTitle =
                      typeof song === "string"
                        ? song
                        : song?.title || song?.name || "";
                    const songArtist =
                      typeof song === "object" ? song?.artist || "" : "";
                    const songDuration =
                      typeof song === "object" ? song?.duration || null : null;

                    return (
                      <div key={index} className="setlist-view-song">
                        <div className="setlist-view-song-number">{index + 1}</div>
                        <div className="setlist-view-song-info">
                          <div className="setlist-view-song-title">{songTitle}</div>
                          {songArtist && (
                            <div className="setlist-view-song-artist">
                              {songArtist}
                            </div>
                          )}
                        </div>
                        {songDuration && (
                          <div className="setlist-view-song-duration">
                            {formatDuration(songDuration)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="setlist-view-empty">
                  This setlist has no songs yet.
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-button confirm-button"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <div className="setlist-view-error">Setlist not found</div>
        )}
      </div>
    </div>
  );
};

export default SetlistViewModal;

