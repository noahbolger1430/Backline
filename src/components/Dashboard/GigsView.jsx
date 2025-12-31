import React, { useState, useEffect } from "react";
import { eventService } from "../../services/eventService";
import { eventApplicationService } from "../../services/eventApplicationService";
import { recommendationService } from "../../services/recommendationService";
import GigApplicationModal from "./GigApplicationModal";
import "./Dashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const GigsView = ({ bandId }) => {
  const [events, setEvents] = useState([]);
  const [recommendedGigs, setRecommendedGigs] = useState([]);
  const [appliedEventIds, setAppliedEventIds] = useState(new Set());
  const [applicationStatuses, setApplicationStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showRecommendations, setShowRecommendations] = useState(true);
  
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

  const fetchRecommendations = async () => {
    if (!bandId) return;
    
    try {
      setLoadingRecommendations(true);
      const response = await recommendationService.getRecommendedGigs(bandId, {
        limit: 10,
        includeApplied: false, // Only show gigs they haven't applied to
      });
      setRecommendedGigs(response.recommended_gigs || []);
    } catch (err) {
      console.warn("Could not fetch recommendations:", err);
      // Don't set error - recommendations are supplementary
      setRecommendedGigs([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRecommendations();
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

  const handleGigClick = async (event, isRecommended = false) => {
    // Record the view for recommendation improvement
    if (bandId && event.id) {
      try {
        await recommendationService.recordGigView(bandId, event.id);
      } catch (err) {
        // Ignore errors - view tracking is not critical
      }
    }
    
    // Only open modal if band hasn't already applied
    const originalEventId = getOriginalEventId(event.id);
    if (!appliedEventIds.has(originalEventId)) {
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
    fetchRecommendations();
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

  // Get reason icon based on type
  const getReasonIcon = (type) => {
    switch (type) {
      case "availability":
        return "📅";
      case "event_genre_match":
        return "🎸";
      case "event_genre_partial":
        return "🎵";
      case "venue_genre_match":
        return "🎶";
      case "venue_genre_partial":
        return "🎼";
      case "genre_discovery":
        return "🔍";
      case "genre_match": // Legacy support
        return "🎵";
      case "past_success":
        return "⭐";
      case "past_rejection":
        return "⚠️";
      case "venue_favorited":
        return "⭐";
      case "timing":
        return "⏰";
      case "low_competition":
        return "🎯";
      // Phase 2: Collaborative filtering - Similar bands
      case "similar_bands_high":
        return "🤝";
      case "similar_bands_medium":
        return "👥";
      case "similar_bands_low":
        return "👤";
      case "similar_genre_bands":
        return "🎭";
      default:
        return "✨";
    }
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

  const getStatusBadge = (eventId, applicationStatus = null) => {
    // For expanded recurring events with synthetic IDs, check the original event ID
    const originalEventId = getOriginalEventId(eventId);
    const hasApplied = applicationStatus !== null || appliedEventIds.has(originalEventId);
    
    if (!hasApplied) {
      return (
        <div className="gig-status-badge accepting">
          <span className="status-dot"></span>
          Accepting Applications
        </div>
      );
    }

    const status = applicationStatus || applicationStatuses[originalEventId];
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

  // Render a recommended gig card
  const renderRecommendedGigCard = (gig) => {
    const hasApplied = gig.has_applied;
    
    return (
      <div
        key={`rec-${gig.id}`}
        className={`gig-card recommended ${hasApplied ? 'applied' : 'clickable'}`}
        onClick={() => handleGigClick({
          id: gig.id,
          name: gig.name,
          description: gig.description,
          event_date: gig.event_date,
          doors_time: gig.doors_time,
          show_time: gig.show_time,
          is_ticketed: gig.is_ticketed,
          ticket_price: gig.ticket_price,
          is_age_restricted: gig.is_age_restricted,
          age_restriction: gig.age_restriction,
          image_path: gig.image_path,
          is_recurring: gig.is_recurring,
          recurring_frequency: gig.recurring_frequency,
          venue_id: gig.venue_id,
          venue_name: gig.venue_name,
          status: "pending",
          is_open_for_applications: true,
        }, true)}
        role={hasApplied ? undefined : "button"}
        tabIndex={hasApplied ? undefined : 0}
        onKeyDown={(e) => {
          if (!hasApplied && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleGigClick({
              id: gig.id,
              name: gig.name,
              description: gig.description,
              event_date: gig.event_date,
              venue_name: gig.venue_name,
              status: "pending",
              is_open_for_applications: true,
            }, true);
          }
        }}
      >
        <div className="recommended-badge">
          <span className="recommended-icon">✨</span>
          Recommended
        </div>
        <div className="gig-image-placeholder">
          {gig.image_path ? (
            <img
              src={`${API_BASE_URL}/${gig.image_path}`}
              alt={gig.name}
              className="gig-image"
              onError={(e) => {
                e.target.style.display = 'none';
                const icon = e.target.parentElement.querySelector('.gig-image-icon');
                if (icon) icon.style.display = 'flex';
              }}
            />
          ) : null}
          <span className="gig-image-icon" style={{ display: gig.image_path ? 'none' : 'flex' }}>
            🎸
          </span>
        </div>
        <div className="gig-card-content">
          <div className="gig-header-row">
            <h3 className="gig-name">{gig.name}</h3>
            {gig.is_recurring && (
              <span className="recurring-event-badge" title="Recurring Event">
                🔁 Recurring
              </span>
            )}
          </div>
          <p className="gig-venue">{gig.venue_name || "Venue TBD"}</p>
          {gig.venue_city && gig.venue_state && (
            <p className="gig-location">{gig.venue_city}, {gig.venue_state}</p>
          )}
          <div className="gig-date">{formatDate(gig.event_date)}</div>
          
          {/* Genre tags */}
          {gig.genre_tags && (
            <div className="gig-genre-tags">
              {gig.genre_tags.split(',').slice(0, 3).map((genre, idx) => (
                <span key={idx} className="genre-tag-pill">{genre.trim()}</span>
              ))}
            </div>
          )}
          
          {/* Recommendation reasons */}
          <div className="recommendation-reasons">
            {gig.recommendation_reasons.slice(0, 3).map((reason, idx) => (
              <span key={idx} className={`reason-tag ${reason.type}`} title={`+${reason.score.toFixed(0)} points`}>
                {getReasonIcon(reason.type)} {reason.label}
              </span>
            ))}
          </div>
          
          {/* Application count indicator */}
          {gig.application_count !== undefined && (
            <div className="application-count">
              {gig.application_count === 0 
                ? "No applicants yet" 
                : `${gig.application_count} applicant${gig.application_count === 1 ? '' : 's'}`
              }
            </div>
          )}
          
          {getStatusBadge(gig.id, gig.application_status)}
        </div>
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

      {/* Recommended Gigs Section */}
      {recommendedGigs.length > 0 && (
        <div className="recommendations-section">
          <div className="recommendations-header">
            <div className="recommendations-title-row">
              <h3 className="recommendations-title">
                <span className="recommendations-icon">✨</span>
                Recommended for You
              </h3>
              <button 
                className="toggle-recommendations-button"
                onClick={() => setShowRecommendations(!showRecommendations)}
              >
                {showRecommendations ? "Hide" : "Show"}
              </button>
            </div>
            <p className="recommendations-subtitle">
              Based on your availability, genre, and past success
            </p>
          </div>
          
          {showRecommendations && (
            <div className="recommendations-grid">
              {loadingRecommendations ? (
                <div className="loading-recommendations">
                  Loading personalized recommendations...
                </div>
              ) : (
                recommendedGigs.map(gig => renderRecommendedGigCard(gig))
              )}
            </div>
          )}
        </div>
      )}

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

      {/* All Gigs Section */}
      <div className="all-gigs-section">
        <h3 className="section-title">All Available Gigs</h3>
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
