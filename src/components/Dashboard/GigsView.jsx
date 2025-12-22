import React, { useState, useEffect } from "react";
import { eventService } from "../../services/eventService";
import { eventApplicationService } from "../../services/eventApplicationService";
import GigApplicationModal from "./GigApplicationModal";
import "./Dashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const GigsView = ({ bandId }) => {
  const [events, setEvents] = useState([]);
  const [appliedEventIds, setAppliedEventIds] = useState(new Set());
  const [applicationStatuses, setApplicationStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch pending events that are open for applications
      const eventsResponse = await eventService.listEvents({
        status: "pending",
        is_open_for_applications: true,
      });
      setEvents(eventsResponse.events || []);

      // Fetch band's existing applications to check which events they've applied to
      if (bandId) {
        try {
          const applicationsResponse = await eventApplicationService.listBandApplications(bandId);
          const appliedIds = new Set();
          const statuses = {};
          
          (applicationsResponse.applications || []).forEach(app => {
            appliedIds.add(app.event_id);
            statuses[app.event_id] = app.status;
          });
          
          setAppliedEventIds(appliedIds);
          setApplicationStatuses(statuses);
        } catch (appErr) {
          // If we can't fetch applications, continue without them
          console.warn("Could not fetch band applications:", appErr);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [bandId]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  };

  const handleGigClick = (event) => {
    // Only open modal if band hasn't already applied
    if (!appliedEventIds.has(event.id)) {
      setSelectedEvent(event);
    }
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  const handleApplicationSubmitted = () => {
    setSelectedEvent(null);
    // Refresh data to update the applied status
    fetchData();
  };

  const getStatusBadge = (eventId) => {
    if (!appliedEventIds.has(eventId)) {
      return (
        <div className="gig-status-badge accepting">
          <span className="status-dot"></span>
          Accepting Applications
        </div>
      );
    }

    const status = applicationStatuses[eventId];
    let badgeClass = "applied";
    let badgeText = "Applied";

    switch (status) {
      case "pending":
        badgeClass = "applied pending";
        badgeText = "Application Pending";
        break;
      case "reviewed":
        badgeClass = "applied reviewed";
        badgeText = "Under Review";
        break;
      case "accepted":
        badgeClass = "applied accepted";
        badgeText = "Accepted!";
        break;
      case "rejected":
        badgeClass = "applied rejected";
        badgeText = "Not Selected";
        break;
      case "withdrawn":
        badgeClass = "applied withdrawn";
        badgeText = "Withdrawn";
        break;
      default:
        badgeText = "Applied";
    }

    return (
      <div className={`gig-status-badge ${badgeClass}`}>
        {badgeText}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="gigs-view">
        <div className="loading-message">Loading available gigs...</div>
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
      <div className="gigs-header">
        <h2 className="gigs-title">Available Gigs</h2>
        <p className="gigs-subtitle">Events currently accepting band applications</p>
      </div>
      <div className="gigs-grid">
        {events.length === 0 ? (
          <div className="no-gigs">
            <span className="no-gigs-icon">🎵</span>
            <p>No gigs currently accepting applications</p>
            <p className="no-gigs-hint">Check back later for new opportunities!</p>
          </div>
        ) : (
          events.map((event) => {
            const hasApplied = appliedEventIds.has(event.id);
            return (
              <div
                key={event.id}
                className={`gig-card ${hasApplied ? 'applied' : 'clickable'}`}
                onClick={() => handleGigClick(event)}
                role={hasApplied ? undefined : "button"}
                tabIndex={hasApplied ? undefined : 0}
                onKeyDown={(e) => {
                  if (!hasApplied && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleGigClick(event);
                  }
                }}
              >
                <div className="gig-image-placeholder">
                  {event.image_path ? (
                    <img
                      src={`${API_BASE_URL}/${event.image_path}`}
                      alt={event.name}
                      className="gig-image"
                      onError={(e) => {
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
                  {getStatusBadge(event.id)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedEvent && (
        <GigApplicationModal
          event={selectedEvent}
          bandId={bandId}
          onClose={handleCloseModal}
          onApplicationSubmitted={handleApplicationSubmitted}
        />
      )}
    </div>
  );
};

export default GigsView;
