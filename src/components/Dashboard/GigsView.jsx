import React, { useState, useEffect } from "react";
import { eventService } from "../../services/eventService";
import "./Dashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const GigsView = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await eventService.listEvents();
        setEvents(response.events || []);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      // Parse the date components to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="gigs-view">
        <div className="loading-message">Loading gigs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gigs-view">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="gigs-view">
      <h2 className="gigs-title">Available Gigs</h2>
      <div className="gigs-grid">
        {events.length === 0 ? (
          <div className="no-gigs">No gigs available</div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="gig-card">
              <div className="gig-image-placeholder">
                {event.image_path ? (
                  <img 
                    src={`${API_BASE_URL}/${event.image_path}`} 
                    alt={event.name}
                    className="gig-image"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      e.target.style.display = 'none';
                      const icon = e.target.parentElement.querySelector('.gig-image-icon');
                      if (icon) icon.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span className="gig-image-icon" style={{ display: event.image_path ? 'none' : 'flex' }}>
                  🎸
                </span>
              </div>
              <div className="gig-card-content">
                <h3 className="gig-name">{event.name}</h3>
                <p className="gig-venue">{event.venue_name || "Venue TBD"}</p>
                <div className="gig-date">{formatDate(event.event_date)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GigsView;
