import React, { useState } from "react";
import { eventApplicationService } from "../../services/eventApplicationService";
import { getImageUrl } from "../../utils/imageUtils";
import "./GigApplicationModal.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const GigApplicationModal = ({ event, bandId, onClose, onApplicationSubmitted }) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await eventApplicationService.submitApplication(event.id, bandId, {
        message: message.trim() || null,
      });
      onApplicationSubmitted();
    } catch (err) {
      setError(err.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="gig-application-modal-overlay" onClick={handleOverlayClick}>
      <div className="gig-application-modal">
        <div className="gig-application-modal-header">
          <h2>Apply to Perform</h2>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="gig-application-event-details">
          <div className="event-image-container">
            {event.image_path ? (
              <img
                src={getImageUrl(event.image_path, API_BASE_URL)}
                alt={event.name}
                className="event-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.parentElement.querySelector('.event-image-placeholder');
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="event-image-placeholder" 
              style={{ display: event.image_path ? 'none' : 'flex' }}
            >
              🎸
            </div>
          </div>
          <div className="event-info">
            <h3 className="event-name">{event.name}</h3>
            <p className="event-venue">{event.venue_name}</p>
            <p className="event-date">{formatDate(event.event_date)}</p>
            {event.description && (
              <p className="event-description">{event.description}</p>
            )}
          </div>
        </div>

        {error && <div className="application-error">{error}</div>}

        <form onSubmit={handleSubmit} className="gig-application-form">
          <div className="form-group">
            <label htmlFor="message">Message to Venue (Optional)</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce your band, share your experience, or mention why you'd be a great fit for this event..."
              rows={5}
              maxLength={1000}
              disabled={loading}
            />
            <div className="character-count">
              {message.length}/1000 characters
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GigApplicationModal;
