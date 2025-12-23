import React, { useEffect, useState } from "react";
import { eventService } from "../../services/eventService";
import "./EventModal.css";

const EventModal = ({ event, onClose }) => {
  const [fullEvent, setFullEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!event?.id) return;
      
      try {
        setLoading(true);
        // Fetch full event details including bands
        const eventDetails = await eventService.getEvent(event.id);
        setFullEvent(eventDetails);
      } catch (err) {
        console.error("Error fetching event details:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [event?.id]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return null;
    // Handle time format "HH:MM:SS" or "HH:MM"
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'status-badge-confirmed';
      case 'pending':
        return 'status-badge-pending';
      case 'cancelled':
        return 'status-badge-cancelled';
      default:
        return 'status-badge-default';
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    // Assuming images are served from the backend at /images endpoint
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
    return `${baseUrl}/${imagePath}`;
  };

  if (!event) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        {loading && <div className="modal-loading">Loading event details...</div>}
        
        {error && <div className="modal-error">Error loading event details: {error}</div>}

        {!loading && !error && fullEvent && (
          <>
            {/* Event Image */}
            {fullEvent.image_path && (
              <div className="modal-image-container">
                <img 
                  src={getImageUrl(fullEvent.image_path)} 
                  alt={fullEvent.name}
                  className="modal-event-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Event Title and Status */}
            <div className="modal-header">
              <h2 className="modal-title">{fullEvent.name}</h2>
              <span className={`status-badge ${getStatusBadgeClass(fullEvent.status)}`}>
                {fullEvent.status}
              </span>
            </div>

            {/* Event Date and Time */}
            <div className="modal-section">
              <h3 className="modal-section-title">Date & Time</h3>
              <div className="modal-datetime">
                <div className="modal-info-row">
                  <span className="modal-info-label">Date:</span>
                  <span className="modal-info-value">{formatDate(fullEvent.event_date)}</span>
                </div>
                {fullEvent.doors_time && (
                  <div className="modal-info-row">
                    <span className="modal-info-label">Doors:</span>
                    <span className="modal-info-value">{formatTime(fullEvent.doors_time)}</span>
                  </div>
                )}
                <div className="modal-info-row">
                  <span className="modal-info-label">Show Time:</span>
                  <span className="modal-info-value">{formatTime(fullEvent.show_time)}</span>
                </div>
              </div>
            </div>

            {/* Event Description */}
            {fullEvent.description && (
              <div className="modal-section">
                <h3 className="modal-section-title">Description</h3>
                <p className="modal-description">{fullEvent.description}</p>
              </div>
            )}

            {/* Bands on the Bill */}
            <div className="modal-section">
              <h3 className="modal-section-title">Bands on the Bill</h3>
              <div className="modal-bands-list">
                {fullEvent.bands && fullEvent.bands.length > 0 ? (
                  fullEvent.bands
                    .sort((a, b) => {
                      // Sort by performance_order if available
                      if (a.performance_order && b.performance_order) {
                        return a.performance_order - b.performance_order;
                      }
                      return 0;
                    })
                    .map((bandEvent, index) => (
                      <div key={bandEvent.id || index} className="modal-band-item">
                        <div className="band-item-header">
                          {bandEvent.performance_order && (
                            <span className="band-order">#{bandEvent.performance_order}</span>
                          )}
                          <span className="band-name">{bandEvent.band_name}</span>
                          <span className={`band-status ${bandEvent.status}`}>
                            {bandEvent.status}
                          </span>
                        </div>
                        {(bandEvent.set_time || bandEvent.set_length_minutes) && (
                          <div className="band-item-details">
                            {bandEvent.set_time && (
                              <span className="band-detail">
                                Set Time: {formatTime(bandEvent.set_time)}
                              </span>
                            )}
                            {bandEvent.set_length_minutes && (
                              <span className="band-detail">
                                Length: {bandEvent.set_length_minutes} minutes
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="modal-no-bands">No bands scheduled yet</div>
                )}
              </div>
            </div>

            {/* Ticket Information */}
            {fullEvent.is_ticketed && (
              <div className="modal-section">
                <h3 className="modal-section-title">Ticket Information</h3>
                <div className="modal-info-row">
                  <span className="modal-info-label">Price:</span>
                  <span className="modal-info-value modal-price">
                    {fullEvent.ticket_price ? formatCurrency(fullEvent.ticket_price) : 'Free'}
                  </span>
                </div>
              </div>
            )}

            {/* Age Restriction */}
            {fullEvent.is_age_restricted && (
              <div className="modal-section">
                <h3 className="modal-section-title">Age Restriction</h3>
                <div className="modal-info-row">
                  <span className="modal-info-label">Minimum Age:</span>
                  <span className="modal-info-value">{fullEvent.age_restriction}+</span>
                </div>
              </div>
            )}

            {/* Venue Information */}
            <div className="modal-section">
              <h3 className="modal-section-title">Venue</h3>
              <div className="modal-info-row">
                <span className="modal-info-value">{fullEvent.venue_name}</span>
              </div>
            </div>

            {/* Application Status */}
            {fullEvent.status === 'pending' && (
              <div className="modal-section">
                <h3 className="modal-section-title">Applications</h3>
                <div className="modal-info-row">
                  <span className="modal-info-label">Open for Applications:</span>
                  <span className={`modal-info-value ${fullEvent.is_open_for_applications ? 'text-success' : 'text-muted'}`}>
                    {fullEvent.is_open_for_applications ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EventModal;
