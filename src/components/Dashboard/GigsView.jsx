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
  
  // Filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterVenue, setFilterVenue] = useState("");
  const [filterApplicationStatus, setFilterApplicationStatus] = useState("all");

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch pending events that are open for applications
      // Expand recurring events to show individual instances with specific dates
      const eventsResponse = await eventService.listEvents({
        status: "pending",
        is_open_for_applications: true,
        expand_recurring: true,
      });
      setEvents(eventsResponse.events || []);

      // Fetch band's existing applications to check which events they've applied to
      if (bandId) {
        try {
          const applicationsResponse = await eventApplicationService.listBandApplications(bandId);
          const appliedIds = new Set();
          const statuses = {};
          
          (applicationsResponse.applications || []).forEach(app => {
            // Applications are stored with the original event ID
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

  const formatRecurringDateRange = (event) => {
    if (!event.is_recurring || !event.recurring_start_date || !event.recurring_end_date) {
      return null;
    }
    const start = formatDate(event.recurring_start_date);
    const end = formatDate(event.recurring_end_date);
    return `${start} - ${end}`;
  };

  const getRecurringFrequencyText = (frequency) => {
    switch (frequency) {
      case "weekly":
        return "Weekly";
      case "bi_weekly":
        return "Bi-Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Recurring";
    }
  };

  const getDayName = (weekday) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return days[weekday] || "";
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

  // Helper function to extract original event ID from synthetic ID
  const getOriginalEventId = (eventId) => {
    // Synthetic IDs are: original_id * 1000000 + date_as_int
    // If the ID is large enough, it might be synthetic
    if (eventId > 1000000) {
      const potentialOriginalId = Math.floor(eventId / 1000000);
      const datePart = eventId % 1000000;
      const datePartStr = String(datePart);
      
      // Check if date part looks like a valid date (6-8 digits)
      if (datePartStr.length >= 6 && datePartStr.length <= 8) {
        return potentialOriginalId;
      }
    }
    return eventId;
  };

  // Filter events based on date range and venue
  const filteredEvents = events.filter((event) => {
    // Only show pending events (backend should filter this, but add safety check)
    if (event.status !== "pending") {
      return false;
    }
    
    // Only show events that are open for applications
    if (!event.is_open_for_applications) {
      return false;
    }
    
    // Filter by date range - now all events have a specific event_date (expanded instances)
    if (filterStartDate || filterEndDate) {
      const eventDate = new Date(event.event_date);
      
      if (filterStartDate) {
        const startDate = new Date(filterStartDate);
        if (eventDate < startDate) {
          return false;
        }
      }
      
      if (filterEndDate) {
        const endDate = new Date(filterEndDate);
        // Set end date to end of day for inclusive comparison
        endDate.setHours(23, 59, 59, 999);
        if (eventDate > endDate) {
          return false;
        }
      }
    }

    // Filter by venue
    if (filterVenue.trim()) {
      const venueFilter = filterVenue.toLowerCase().trim();
      const venueName = (event.venue_name || "").toLowerCase();
      if (!venueName.includes(venueFilter)) {
        return false;
      }
    }

    // Filter by application status
    if (filterApplicationStatus !== "all") {
      const originalEventId = getOriginalEventId(event.id);
      const hasApplied = appliedEventIds.has(originalEventId);
      
      if (filterApplicationStatus === "none") {
        // Show only events without applications
        if (hasApplied) {
          return false;
        }
      } else {
        // Show only events with the selected application status
        if (!hasApplied) {
          return false;
        }
        const status = applicationStatuses[originalEventId];
        if (status !== filterApplicationStatus) {
          return false;
        }
      }
    }

    return true;
  });

  const clearFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterVenue("");
    setFilterApplicationStatus("all");
  };

  const hasActiveFilters = () => {
    return !!(filterStartDate || filterEndDate || filterVenue.trim() || filterApplicationStatus !== "all");
  };

  const getStatusBadge = (eventId) => {
    // For expanded recurring events with synthetic IDs, check the original event ID
    const originalEventId = getOriginalEventId(eventId);
    const hasApplied = appliedEventIds.has(originalEventId);
    
    if (!hasApplied) {
      return (
        <div className="gig-status-badge accepting">
          <span className="status-dot"></span>
          Accepting Applications
        </div>
      );
    }

    const status = applicationStatuses[originalEventId];
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

      {/* Filter Section */}
      <div className="gigs-filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Start Date</label>
            <input
              type="date"
              className="filter-input"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">End Date</label>
            <input
              type="date"
              className="filter-input"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Venue</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Venue name..."
              value={filterVenue}
              onChange={(e) => setFilterVenue(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Application Status</label>
            <select
              className="filter-select"
              value={filterApplicationStatus}
              onChange={(e) => setFilterApplicationStatus(e.target.value)}
            >
              <option value="all">All Gigs</option>
              <option value="none">Accepting Applications</option>
              <option value="pending">Application Pending</option>
              <option value="reviewed">Under Review</option>
              <option value="accepted">Accepted!</option>
              <option value="rejected">Not Selected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          {hasActiveFilters() && (
            <button className="clear-filters-button" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {hasActiveFilters() && (
          <div className="filter-results-info">
            Showing {filteredEvents.length} of {events.length} gigs
          </div>
        )}
      </div>

      <div className="gigs-grid">
        {events.length === 0 ? (
          <div className="no-gigs">
            <span className="no-gigs-icon">🎵</span>
            <p>No gigs currently accepting applications</p>
            <p className="no-gigs-hint">Check back later for new opportunities!</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="no-gigs">
            <span className="no-gigs-icon">🎵</span>
            <p>No gigs match your filter criteria</p>
            <p className="no-gigs-hint">Try adjusting your filters</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            // For expanded recurring events, check if band has applied using original event ID
            const originalEventId = getOriginalEventId(event.id);
            const hasApplied = appliedEventIds.has(originalEventId);
            
            // Check if this is an expanded recurring event instance (has synthetic ID)
            const isExpandedRecurring = event.id > 1000000 && originalEventId !== event.id;
            
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
                  <div className="gig-header-row">
                    <h3 className="gig-name">{event.name}</h3>
                    {isExpandedRecurring && (
                      <span className="recurring-event-badge" title="Recurring Event">
                        🔁 Recurring
                      </span>
                    )}
                  </div>
                  <p className="gig-venue">{event.venue_name || "Venue TBD"}</p>
                  {/* Always show the specific event date for expanded instances */}
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
