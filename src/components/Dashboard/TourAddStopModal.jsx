import React, { useState, useEffect, useMemo } from "react";
import { venueService } from "../../services/venueService";
import { getImageUrl } from "../../utils/imageUtils";
import "./TourGenerator.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const TourAddStopModal = ({ 
  isOpen, 
  onClose, 
  onSelectType,
  bandId,
  tourParams,
  onAddVenue,
  startDate,
  endDate
}) => {
  const [view, setView] = useState("selection"); // "selection" or "venue"
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (view === "venue") {
      fetchVenues();
    }
  }, [view, bandId]);

  const fetchVenues = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = bandId ? { band_id: bandId } : {};
      const response = await venueService.listVenues(params);
      setVenues(response.venues || []);
    } catch (err) {
      console.error("Error fetching venues:", err);
      setError(err.message || "Failed to load venues");
    } finally {
      setLoading(false);
    }
  };

  // Filter venues based on search and tour params
  const filteredVenues = useMemo(() => {
    let filtered = venues;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((venue) => {
        const nameMatch = venue.name?.toLowerCase().includes(query);
        const cityMatch = venue.city?.toLowerCase().includes(query);
        const stateMatch = venue.state?.toLowerCase().includes(query);
        return nameMatch || cityMatch || stateMatch;
      });
    }

    // Filter by capacity if tour params exist
    if (tourParams?.preferred_venue_capacity_min) {
      filtered = filtered.filter(
        (v) => !v.capacity || v.capacity >= tourParams.preferred_venue_capacity_min
      );
    }
    if (tourParams?.preferred_venue_capacity_max) {
      filtered = filtered.filter(
        (v) => !v.capacity || v.capacity <= tourParams.preferred_venue_capacity_max
      );
    }

    // Sort: favorited first, then by name
    return filtered.sort((a, b) => {
      if (a.is_favorited && !b.is_favorited) return -1;
      if (!a.is_favorited && b.is_favorited) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [venues, searchQuery, tourParams]);

  const formatLocation = (venue) => {
    const parts = [];
    if (venue.city) parts.push(venue.city);
    if (venue.state) parts.push(venue.state);
    return parts.join(", ") || "Location not specified";
  };

  const hasContactInfo = (venue) => {
    return !!(venue.contact_name || venue.contact_email || venue.contact_phone);
  };

  const handleVenueSelect = (venue) => {
    setSelectedVenue(venue.id === selectedVenue?.id ? null : venue);
  };

  const handleSubmit = () => {
    if (selectedVenue && selectedDate) {
      onAddVenue(selectedVenue, selectedDate);
      onClose();
    }
  };

  const handleBack = () => {
    setView("selection");
    setSelectedVenue(null);
    setSelectedDate("");
    setSearchQuery("");
  };

  if (!isOpen) return null;

  // Render venue selection view
  if (view === "venue") {
    return (
      <div className="tour-add-stop-modal-overlay" onClick={onClose}>
        <div className="tour-add-stop-modal" onClick={(e) => e.stopPropagation()}>
          <div className="tour-add-stop-venue-view">
            <div className="tour-add-stop-venue-header">
              <button className="tour-add-stop-back-button" onClick={handleBack}>
                ←
              </button>
              <h3 className="tour-add-stop-modal-header" style={{ margin: 0 }}>
                Select Venue
              </h3>
            </div>

            <div className="tour-add-stop-search">
              <input
                type="text"
                className="tour-add-stop-search-input"
                placeholder="Search venues by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {loading ? (
              <div className="tour-add-stop-loading">
                <div className="loading-spinner"></div>
                <span>Loading venues...</span>
              </div>
            ) : error ? (
              <div className="tour-add-stop-empty">
                <p>Error loading venues: {error}</p>
              </div>
            ) : (
              <>
                <div className="tour-add-stop-venue-list">
                  {filteredVenues.length === 0 ? (
                    <div className="tour-add-stop-empty">
                      {searchQuery ? (
                        <p>No venues match your search criteria</p>
                      ) : (
                        <p>No venues available</p>
                      )}
                    </div>
                  ) : (
                    filteredVenues.map((venue) => (
                      <div
                        key={venue.id}
                        className={`tour-add-stop-venue-item ${
                          selectedVenue?.id === venue.id ? "selected" : ""
                        }`}
                        onClick={() => handleVenueSelect(venue)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleVenueSelect(venue);
                          }
                        }}
                      >
                        <div className="tour-add-stop-venue-image">
                          {venue.image_path ? (
                            <img
                              src={getImageUrl(venue.image_path, API_BASE_URL)}
                              alt={venue.name}
                              onError={(e) => {
                                e.target.style.display = "none";
                                const icon = e.target.parentElement.querySelector(
                                  ".tour-add-stop-venue-icon"
                                );
                                if (icon) icon.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <span
                            className="tour-add-stop-venue-icon"
                            style={{ display: venue.image_path ? "none" : "flex" }}
                          >
                            🏛️
                          </span>
                        </div>

                        <div className="tour-add-stop-venue-details">
                          <h4 className="tour-add-stop-venue-name">{venue.name}</h4>
                          <p className="tour-add-stop-venue-location">
                            {formatLocation(venue)}
                          </p>

                          <div className="tour-add-stop-venue-tags">
                            {venue.capacity && (
                              <span className="tour-add-stop-venue-tag">
                                👥 {venue.capacity.toLocaleString()} capacity
                              </span>
                            )}
                            {venue.is_favorited && (
                              <span className="tour-add-stop-venue-tag favorited">
                                ⭐ Favorited
                              </span>
                            )}
                            {hasContactInfo(venue) && (
                              <span className="tour-add-stop-venue-tag">
                                📞 Has Contact
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="tour-add-stop-venue-select">
                          {selectedVenue?.id === venue.id ? "✓" : ""}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedVenue && (
                  <div className="tour-add-stop-date-section">
                    <label className="tour-add-stop-date-label">
                      Select Date for This Stop
                    </label>
                    <input
                      type="date"
                      className="tour-add-stop-date-input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={startDate}
                      max={endDate}
                    />
                    <p className="tour-add-stop-date-help">
                      Choose a date within your tour dates ({startDate} to {endDate})
                    </p>
                  </div>
                )}

                <div className="tour-add-stop-actions">
                  <button
                    className="tour-add-stop-cancel-button"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="tour-add-stop-submit-button"
                    onClick={handleSubmit}
                    disabled={!selectedVenue || !selectedDate}
                  >
                    Add Venue to Tour
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render initial selection view
  return (
    <div className="tour-add-stop-modal-overlay" onClick={onClose}>
      <div className="tour-add-stop-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="tour-add-stop-modal-header">Add Tour Stop</h3>
        
        <div className="tour-add-stop-options">
          <div
            className="tour-add-stop-option event"
            onClick={() => onSelectType("event")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectType("event");
              }
            }}
          >
            <span className="tour-add-stop-option-icon">🎵</span>
            <h4 className="tour-add-stop-option-title">Add Event</h4>
            <p className="tour-add-stop-option-description">
              Browse and add existing events that are accepting applications
            </p>
          </div>

          <div
            className="tour-add-stop-option venue"
            onClick={() => setView("venue")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setView("venue");
              }
            }}
          >
            <span className="tour-add-stop-option-icon">🏛️</span>
            <h4 className="tour-add-stop-option-title">Add Venue</h4>
            <p className="tour-add-stop-option-description">
              Search venues to contact directly for booking opportunities
            </p>
          </div>
        </div>

        <div className="tour-add-stop-modal-actions">
          <button
            className="tour-add-stop-cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TourAddStopModal;
