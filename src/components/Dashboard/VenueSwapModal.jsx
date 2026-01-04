import React, { useState, useEffect, useMemo } from "react";
import { venueService } from "../../services/venueService";
import { getImageUrl } from "../../utils/imageUtils";
import "./TourGenerator.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const VenueSwapModal = ({ 
  currentVenue, 
  suggestedDate,
  bandId, 
  onClose, 
  onSwap,
  tourParams 
}) => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState(null);

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch venues with band_id to get favorite status
        const params = bandId ? { band_id: bandId } : {};
        const response = await venueService.listVenues(params);
        
        // Filter out the current venue
        const availableVenues = (response.venues || []).filter(
          (v) => v.id !== currentVenue.venue_id
        );
        
        setVenues(availableVenues);
      } catch (err) {
        console.error("Error fetching venues:", err);
        setError(err.message || "Failed to load venues");
      } finally {
        setLoading(false);
      }
    };

    fetchVenues();
  }, [bandId, currentVenue.venue_id]);

  // Filter venues based on search and optionally tour params
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

    // Optionally filter by capacity if tour params exist
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

  const formatContactPreview = (venue) => {
    if (venue.contact_email) return venue.contact_email;
    if (venue.contact_phone) return venue.contact_phone;
    if (venue.contact_name) return venue.contact_name;
    return null;
  };

  const handleVenueSelect = (venue) => {
    setSelectedVenue(venue.id === selectedVenue?.id ? null : venue);
  };

  const handleConfirmSwap = () => {
    if (selectedVenue) {
      onSwap(currentVenue, selectedVenue, suggestedDate);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="venue-swap-modal-overlay" onClick={handleOverlayClick}>
      <div className="venue-swap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="venue-swap-modal-header">
          <div>
            <h3 className="venue-swap-modal-title">Swap Venue</h3>
            <p className="venue-swap-modal-subtitle">
              Select a different venue for this tour stop
            </p>
          </div>
          <button className="venue-swap-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="venue-swap-modal-search">
          <input
            type="text"
            className="venue-swap-search-input"
            placeholder="Search venues by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="venue-swap-modal-content">
          {loading ? (
            <div className="venue-swap-loading">
              <div className="loading-spinner"></div>
              <span className="venue-swap-loading-text">Loading venues...</span>
            </div>
          ) : error ? (
            <div className="venue-swap-empty">
              <p>Error loading venues: {error}</p>
            </div>
          ) : filteredVenues.length === 0 ? (
            <div className="venue-swap-empty">
              {searchQuery ? (
                <p>No venues match your search criteria</p>
              ) : (
                <p>No alternative venues available</p>
              )}
            </div>
          ) : (
            <div className="venue-swap-list">
              {filteredVenues.map((venue) => (
                <div
                  key={venue.id}
                  className={`venue-swap-item ${selectedVenue?.id === venue.id ? "selected" : ""}`}
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
                  <div className="venue-swap-item-image">
                    {venue.image_path ? (
                      <img
                        src={getImageUrl(venue.image_path, API_BASE_URL)}
                        alt={venue.name}
                        onError={(e) => {
                          e.target.style.display = "none";
                          const icon = e.target.parentElement.querySelector(".venue-swap-item-icon");
                          if (icon) icon.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <span
                      className="venue-swap-item-icon"
                      style={{ display: venue.image_path ? "none" : "flex" }}
                    >
                      🏛️
                    </span>
                  </div>

                  <div className="venue-swap-item-details">
                    <h4 className="venue-swap-item-name">{venue.name}</h4>
                    <p className="venue-swap-item-location">{formatLocation(venue)}</p>
                    
                    <div className="venue-swap-item-meta">
                      {venue.capacity && (
                        <span className="venue-swap-item-tag capacity">
                          🎭 {venue.capacity.toLocaleString()} capacity
                        </span>
                      )}
                      {venue.is_favorited && (
                        <span className="venue-swap-item-tag favorited">
                          ⭐ Favorited
                        </span>
                      )}
                      {hasContactInfo(venue) && (
                        <span className="venue-swap-item-tag">
                          📞 Has Contact
                        </span>
                      )}
                    </div>

                    {hasContactInfo(venue) && (
                      <p className="venue-swap-item-contact">
                        {formatContactPreview(venue)}
                      </p>
                    )}
                  </div>

                  <div className="venue-swap-item-select">
                    {selectedVenue?.id === venue.id ? "✓" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="venue-swap-modal-footer">
          <div className="venue-swap-current-info">
            Replacing: <strong>{currentVenue.venue_name}</strong>
          </div>
          <div className="venue-swap-modal-actions">
            <button className="venue-swap-cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="venue-swap-confirm-button"
              onClick={handleConfirmSwap}
              disabled={!selectedVenue}
            >
              Swap Venue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueSwapModal;