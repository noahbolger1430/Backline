import React, { useState, useEffect } from "react";
import { stagePlotService } from "../../services/stagePlotService";
import "./StagePlotList.css";

const StagePlotList = ({ bandId, onBack, onSelect, onCreateNew }) => {
  const [stagePlots, setStagePlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchStagePlots();
  }, [bandId]);

  const fetchStagePlots = async () => {
    try {
      setLoading(true);
      const plots = await stagePlotService.getBandStagePlots(bandId);
      setStagePlots(plots);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch stage plots:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (plotId, plotName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${plotName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(plotId);
      await stagePlotService.deleteStagePlot(plotId);
      setStagePlots(stagePlots.filter(plot => plot.id !== plotId));
    } catch (err) {
      console.error("Failed to delete stage plot:", err);
      alert(`Failed to delete stage plot: ${err.message}`);
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
      <div className="stage-plot-list-container">
        <div className="stage-plot-list-loading">Loading stage plots...</div>
      </div>
    );
  }

  return (
    <div className="stage-plot-list-container">
      <div className="stage-plot-list-header">
        <button className="back-button" onClick={onBack}>
          <span className="back-arrow">←</span>
          Back to Tools
        </button>
        <h2 className="stage-plot-list-title">Stage Plots</h2>
        <button className="create-new-button" onClick={onCreateNew}>
          <span className="plus-icon">+</span>
          Create New
        </button>
      </div>

      <div className="stage-plot-list-content">
        {error && (
          <div className="error-message">{error}</div>
        )}

        {stagePlots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎸</div>
            <h3 className="empty-state-title">No Stage Plots Yet</h3>
            <p className="empty-state-description">
              Create your first stage plot to visualize your band's setup
            </p>
            <button className="empty-state-button" onClick={onCreateNew}>
              Create Stage Plot
            </button>
          </div>
        ) : (
          <div className="stage-plot-grid">
            {stagePlots.map((plot) => (
              <div key={plot.id} className="stage-plot-card">
                <div className="stage-plot-card-header">
                  <h3 className="stage-plot-card-title">{plot.name}</h3>
                  <button
                    className="stage-plot-delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(plot.id, plot.name);
                    }}
                    disabled={deletingId === plot.id}
                    title="Delete stage plot"
                  >
                    {deletingId === plot.id ? "..." : "×"}
                  </button>
                </div>
                
                {plot.description && (
                  <p className="stage-plot-card-description">{plot.description}</p>
                )}
                
                <div className="stage-plot-card-meta">
                  <span className="stage-plot-card-items">
                    📦 {plot.item_count} {plot.item_count === 1 ? "item" : "items"}
                  </span>
                  <span className="stage-plot-card-date">
                    Updated {formatDate(plot.updated_at)}
                  </span>
                </div>

                <button
                  className="stage-plot-card-button"
                  onClick={() => onSelect(plot.id)}
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

export default StagePlotList;
