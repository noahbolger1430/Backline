import React, { useState, useEffect, useRef } from "react";
import { bandService } from "../../services/bandService";
import { venueRecommendationService } from "../../services/venueRecommendationService";
import "./Dashboard.css";

const BandSearchSelect = ({ selectedBands, onBandsChange, eventId = null, venueId = null }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [bands, setBands] = useState([]);
  const [recommendedBands, setRecommendedBands] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);
  const hasFetchedRecommendations = useRef(false);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch recommendations when eventId/venueId are available
  useEffect(() => {
    if (eventId && venueId && !hasFetchedRecommendations.current) {
      fetchRecommendations();
      hasFetchedRecommendations.current = true;
    }
  }, [eventId, venueId]);

  const fetchRecommendations = async () => {
    if (!eventId || !venueId) return;
    
    try {
      setLoadingRecommendations(true);
      const response = await venueRecommendationService.getRecommendedBands(
        venueId,
        eventId,
        { limit: 10 }
      );
      
      // Filter out already selected bands
      const filtered = (response.recommended_bands || []).filter(
        (band) => !selectedBands.some((selected) => selected.id === band.id)
      );
      setRecommendedBands(filtered);
    } catch (error) {
      console.warn("Could not fetch band recommendations:", error);
      setRecommendedBands([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchBands(searchTerm);
      }, 300);
    } else if (searchTerm.trim().length === 0) {
      setBands([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const searchBands = async (term) => {
    try {
      setLoading(true);
      const results = await bandService.searchBands(term);
      // Filter out already selected bands
      const filtered = results.filter(
        (band) => !selectedBands.some((selected) => selected.id === band.id)
      );
      setBands(filtered);
      setIsOpen(true);
    } catch (error) {
      console.error("Error searching bands:", error);
      setBands([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBand = (band) => {
    if (!selectedBands.some((b) => b.id === band.id)) {
      onBandsChange([...selectedBands, band]);
    }
    setSearchTerm("");
    setBands([]);
    // Also remove from recommendations
    setRecommendedBands(recommendedBands.filter(b => b.id !== band.id));
    setIsOpen(false);
  };

  const handleRemoveBand = (bandId) => {
    onBandsChange(selectedBands.filter((b) => b.id !== bandId));
  };

  const handleFocus = () => {
    // Show dropdown if we have any results (recommendations or search)
    if (bands.length > 0 || recommendedBands.length > 0) {
      setIsOpen(true);
    }
  };

  // Get icon for recommendation reason
  const getReasonIcon = (type) => {
    switch (type) {
      case "event_genre_match":
        return "🎸";
      case "event_genre_partial":
        return "🎵";
      case "venue_genre_match":
        return "🎶";
      case "venue_genre_partial":
        return "🎼";
      case "previous_success":
        return "⭐";
      case "gig_activity_high":
        return "🔥";
      case "gig_activity_medium":
        return "📈";
      case "gig_activity_low":
        return "📊";
      case "profile_complete":
        return "✓";
      case "profile_partial":
        return "📋";
      case "location_local":
        return "📍";
      case "location_state":
        return "🗺️";
      case "location_nearby":
        return "🚗";
      default:
        return "✨";
    }
  };

  // Filter out selected bands from recommendations for display
  const filteredRecommendations = recommendedBands.filter(
    (band) => !selectedBands.some((selected) => selected.id === band.id)
  );

  const hasResults = bands.length > 0 || filteredRecommendations.length > 0;

  return (
    <div className="band-search-select" ref={dropdownRef}>
      <label htmlFor="band-search">Bands</label>
      <div className="band-search-input-container">
        <input
          type="text"
          id="band-search"
          className="band-search-input"
          placeholder="Search for bands to add..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={handleFocus}
        />
        {loading && <div className="band-search-loading">Searching...</div>}
      </div>

      {isOpen && hasResults && (
        <div className="band-search-dropdown">
          {/* Recommendations section */}
          {filteredRecommendations.length > 0 && !searchTerm && (
            <div className="band-search-recommendations-section">
              <div className="band-search-section-header">
                <span className="band-search-section-title">
                  <span className="recommendation-icon">✨</span>
                  Recommended
                </span>
                <button
                  type="button"
                  className="band-search-section-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRecommendations(!showRecommendations);
                  }}
                >
                  {showRecommendations ? "Hide" : "Show"}
                </button>
              </div>
              {showRecommendations && filteredRecommendations.map((band) => (
                <div
                  key={`rec-${band.id}`}
                  className="band-search-option recommended"
                  onClick={() => handleSelectBand(band)}
                >
                  <div className="band-search-option-main">
                    <div className="band-search-option-name">{band.name}</div>
                    {band.genre && (
                      <div className="band-search-option-genre">{band.genre}</div>
                    )}
                    {band.location && (
                      <div className="band-search-option-location">{band.location}</div>
                    )}
                  </div>
                  {band.recommendation_reasons && band.recommendation_reasons.length > 0 && (
                    <div className="band-search-recommendation-reasons">
                      {band.recommendation_reasons.slice(0, 3).map((reason, idx) => (
                        <span 
                          key={idx} 
                          className={`band-reason-tag ${reason.type}`}
                          title={`+${reason.score.toFixed(0)} points`}
                        >
                          {getReasonIcon(reason.type)} {reason.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Search results section */}
          {bands.length > 0 && (
            <div className="band-search-results-section">
              {filteredRecommendations.length > 0 && !searchTerm && (
                <div className="band-search-section-header">
                  <span className="band-search-section-title">All Bands</span>
                </div>
              )}
              {bands.map((band) => (
                <div
                  key={band.id}
                  className="band-search-option"
                  onClick={() => handleSelectBand(band)}
                >
                  <div className="band-search-option-name">{band.name}</div>
                  {band.genre && (
                    <div className="band-search-option-genre">{band.genre}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Loading recommendations indicator */}
          {loadingRecommendations && !searchTerm && (
            <div className="band-search-loading-recommendations">
              Loading recommended bands...
            </div>
          )}
        </div>
      )}

      {selectedBands.length > 0 && (
        <div className="selected-bands-list">
          {selectedBands.map((band) => (
            <div key={band.id} className="selected-band-tag">
              <span>{band.name}</span>
              <button
                type="button"
                className="remove-band-button"
                onClick={() => handleRemoveBand(band.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BandSearchSelect;
