import React, { useState, useEffect, useCallback, useRef } from "react";
import { tourService } from "../../services/tourService";
import { getImageUrl } from "../../utils/imageUtils";
import "./TourGenerator.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const TourGenerator = ({ bandId, onBack }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tourRadius, setTourRadius] = useState(1000);
  const [startingLocation, setStartingLocation] = useState("");
  const [minDaysBetweenShows, setMinDaysBetweenShows] = useState(0);
  const [maxDaysBetweenShows, setMaxDaysBetweenShows] = useState(7);
  const [maxDriveHours, setMaxDriveHours] = useState(8);
  const [prioritizeWeekends, setPrioritizeWeekends] = useState(true);
  const [preferredGenres, setPreferredGenres] = useState("");
  const [minVenueCapacity, setMinVenueCapacity] = useState(100);
  const [maxVenueCapacity, setMaxVenueCapacity] = useState(5000);
  
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [tourResults, setTourResults] = useState(null);
  const [availabilitySummary, setAvailabilitySummary] = useState(null);
  const [showSettings, setShowSettings] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [algorithmWeights, setAlgorithmWeights] = useState({
    genreMatchWeight: 0.25,
    capacityMatchWeight: 0.15,
    distanceWeight: 0.20,
    weekendPreferenceWeight: 0.15,
    recommendationScoreWeight: 0.25,
  });

  const regenerateTimeoutRef = useRef(null);

  useEffect(() => {
    const today = new Date();
    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    const threeMonthsFromNow = new Date(today);
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    
    setStartDate(oneMonthFromNow.toISOString().split("T")[0]);
    setEndDate(threeMonthsFromNow.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate && bandId) {
      fetchAvailabilitySummary();
    }
  }, [startDate, endDate, bandId]);

  const fetchAvailabilitySummary = async () => {
    try {
      const summary = await tourService.getTourAvailabilitySummary(
        bandId,
        startDate,
        endDate
      );
      setAvailabilitySummary(summary);
    } catch (err) {
      console.warn("Could not fetch availability summary:", err);
    }
  };

  const handleGenerateTour = useCallback(async (isRegeneration = false) => {
    setError(null);

    if (!startDate || !endDate) {
      setError("Please select start and end dates");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date");
      return;
    }

    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      setError("Tour duration cannot exceed 365 days");
      return;
    }

    try {
      if (isRegeneration) {
        setRegenerating(true);
      } else {
        setGenerating(true);
      }
      
      const genreList = preferredGenres
        ? preferredGenres.split(",").map(g => g.trim()).filter(g => g)
        : null;

      const tourParams = {
        start_date: startDate,
        end_date: endDate,
        tour_radius_km: tourRadius,
        starting_location: startingLocation || null,
        min_days_between_shows: minDaysBetweenShows,
        max_days_between_shows: maxDaysBetweenShows,
        max_drive_hours_per_day: maxDriveHours,
        prioritize_weekends: prioritizeWeekends,
        preferred_genres: genreList,
        preferred_venue_capacity_min: minVenueCapacity,
        preferred_venue_capacity_max: maxVenueCapacity,
        algorithm_weights: algorithmWeights,
      };

      const results = await tourService.generateTour(bandId, tourParams);
      setTourResults(results);
      if (!isRegeneration) {
        setShowSettings(false);
      }
    } catch (err) {
      console.error("Failed to generate tour:", err);
      setError(err.message || "Failed to generate tour");
    } finally {
      setGenerating(false);
      setRegenerating(false);
    }
  }, [startDate, endDate, tourRadius, startingLocation, minDaysBetweenShows, 
      maxDaysBetweenShows, maxDriveHours, prioritizeWeekends, preferredGenres, 
      minVenueCapacity, maxVenueCapacity, algorithmWeights, bandId]);

  const handleWeightChange = useCallback((weightKey, value) => {
    // Handle algorithm weight changes with automatic regeneration.
    setAlgorithmWeights(prev => ({
      ...prev,
      [weightKey]: value
    }));

    if (tourResults) {
      if (regenerateTimeoutRef.current) {
        clearTimeout(regenerateTimeoutRef.current);
      }
      
      regenerateTimeoutRef.current = setTimeout(() => {
        handleGenerateTour(true);
      }, 500);
    }
  }, [tourResults, handleGenerateTour]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    // Parse date string manually to avoid timezone issues
    // Date strings from backend are in format "YYYY-MM-DD"
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDayOfWeek = (dateString) => {
    if (!dateString) return "";
    // Parse date string manually to avoid timezone issues
    // Date strings from backend are in format "YYYY-MM-DD"
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "#6F22D2";
      case "medium":
        return "#FFA500";
      case "low":
        return "#888888";
      default:
        return "#C5C6C7";
    }
  };

  const formatSliderValue = (value, suffix = "") => {
    // Format slider values for display.
    return `${value.toLocaleString()}${suffix}`;
  };

  const renderTourStop = (item, index, isEvent) => {
    const date = isEvent ? item.event_date : item.suggested_date;
    const priorityColor = getPriorityColor(item.priority || item.booking_priority);
    
    return (
      <div key={`stop-${index}`} className="tour-stop">
        <div className="tour-date">
          <div className="tour-date-text">{formatDate(date)}</div>
          <div className="tour-day-text">{formatDayOfWeek(date)}</div>
        </div>
        
        <div className="tour-timeline-connector">
          <div className="tour-timeline-dot" style={{ backgroundColor: priorityColor }}></div>
          {index < (tourResults.recommended_events.length + tourResults.recommended_venues.length - 1) && (
            <div className="tour-timeline-line"></div>
          )}
        </div>

        <div className={`tour-stop-card ${isEvent ? "event" : "venue"}`}>
          {isEvent ? (
            <>
              <div className="tour-stop-image">
                {item.image_path ? (
                  <img
                    src={getImageUrl(item.image_path, API_BASE_URL)}
                    alt={item.event_name}
                    onError={(e) => {
                      e.target.style.display = "none";
                      const icon = e.target.parentElement.querySelector(".tour-stop-image-icon");
                      if (icon) icon.style.display = "flex";
                    }}
                  />
                ) : null}
                <span 
                  className="tour-stop-image-icon" 
                  style={{ display: item.image_path ? "none" : "flex" }}
                >
                  🎵
                </span>
              </div>
              
              <div className="tour-stop-details">
                <h3 className="tour-stop-name">{item.event_name}</h3>
                <div className="tour-stop-venue">{item.venue_name}</div>
                <div className="tour-stop-location">{item.venue_location}</div>
                <div className="tour-stop-event-date">
                  📅 {formatDate(item.event_date)} ({formatDayOfWeek(item.event_date)})
                </div>
                
                <div className="tour-stop-tags">
                  {item.is_open_for_applications && (
                    <span className="tour-tag accepting">Open for Applications</span>
                  )}
                  {item.genre_tags && (
                    <span className="tour-tag genre">{item.genre_tags.split(",")[0]}</span>
                  )}
                </div>
                
                <div className="tour-stop-metrics">
                  <span className="tour-metric">
                    📍 {item.distance_from_previous_km} km
                  </span>
                  {item.travel_days_needed > 0 && (
                    <span className="tour-metric">
                      🚐 {item.travel_days_needed} travel day{item.travel_days_needed > 1 ? "s" : ""}
                    </span>
                  )}
                  {item.recommendation_score && (
                    <span className="tour-metric">
                      ⭐ Score: {item.recommendation_score.toFixed(0)}
                    </span>
                  )}
                </div>
                
                <div className="tour-stop-reasons">
                  {item.reasoning.slice(0, 3).map((reason, idx) => (
                    <span key={idx} className="tour-reason">{reason}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="tour-stop-image venue">
                <span className="tour-stop-image-icon">🏢</span>
              </div>
              
              <div className="tour-stop-details">
                <h3 className="tour-stop-name">{item.venue_name}</h3>
                <div className="tour-stop-location">{item.venue_location}</div>
                
                {(item.venue_contact_name || item.venue_contact_email || item.venue_contact_phone) && (
                  <div className="tour-venue-contact">
                    <div className="contact-header">Contact for Direct Booking:</div>
                    {item.venue_contact_name && (
                      <div className="contact-item">👤 {item.venue_contact_name}</div>
                    )}
                    {item.venue_contact_email && (
                      <div className="contact-item">✉️ {item.venue_contact_email}</div>
                    )}
                    {item.venue_contact_phone && (
                      <div className="contact-item">📞 {item.venue_contact_phone}</div>
                    )}
                  </div>
                )}
                
                <div className="tour-stop-tags">
                  <span className="tour-tag venue-booking">Direct Booking Opportunity</span>
                  <span className="tour-tag day">{formatDayOfWeek(item.suggested_date)}</span>
                </div>
                
                <div className="tour-stop-metrics">
                  <span className="tour-metric">
                    📍 {item.distance_from_previous_km} km
                  </span>
                  {item.travel_days_needed > 0 && (
                    <span className="tour-metric">
                      🚐 {item.travel_days_needed} travel day{item.travel_days_needed > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                
                <div className="tour-stop-reasons">
                  {item.reasoning.slice(0, 3).map((reason, idx) => (
                    <span key={idx} className="tour-reason">{reason}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (generating) {
    return (
      <div className="tour-generator-container">
        <div className="tour-generator-loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Generating optimal tour route...</div>
          <div className="loading-subtext">Analyzing venues, events, and availability</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tour-generator-container">
      {regenerating && (
        <div className="tour-regenerating-overlay">
          <div className="tour-regenerating-content">
            <div className="loading-spinner"></div>
            <div className="tour-regenerating-text">Regenerating tour with new weights...</div>
          </div>
        </div>
      )}
      
      <div className="tour-generator-header">
        <button className="tour-back-button" onClick={onBack}>
          <span className="tour-back-arrow">←</span>
          Back
        </button>
        <h2 className="tour-generator-title">Tour Generator</h2>
        {tourResults && (
          <button 
            className="tour-settings-button"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? "Hide Settings" : "Show Settings"}
          </button>
        )}
      </div>

      <div className="tour-generator-content">
        {error && <div className="tour-error-message">{error}</div>}

        {(showSettings || !tourResults) && (
          <div className="tour-settings-panel">
            <div className="tour-settings-grid">
              <div className="tour-form-group">
                <label>Tour Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group">
                <label>Tour End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group tour-slider-group">
                <div className="tour-slider-label">
                  <span>Tour Radius *</span>
                  <span className="tour-slider-value">{formatSliderValue(tourRadius, " km")}</span>
                </div>
                <input
                  type="range"
                  className="tour-slider"
                  value={tourRadius}
                  onChange={(e) => setTourRadius(parseInt(e.target.value))}
                  min="100"
                  max="8000"
                  step="100"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group">
                <label>Starting Location</label>
                <input
                  type="text"
                  value={startingLocation}
                  onChange={(e) => setStartingLocation(e.target.value)}
                  placeholder="City, State"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group">
                <label>Min Days Between Shows</label>
                <input
                  type="number"
                  value={minDaysBetweenShows}
                  onChange={(e) => setMinDaysBetweenShows(parseInt(e.target.value) || 0)}
                  min="0"
                  max="30"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group">
                <label>Max Days Between Shows</label>
                <input
                  type="number"
                  value={maxDaysBetweenShows}
                  onChange={(e) => setMaxDaysBetweenShows(parseInt(e.target.value) || 7)}
                  min="1"
                  max="30"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group tour-slider-group">
                <div className="tour-slider-label">
                  <span>Max Driving Hours/Day</span>
                  <span className="tour-slider-value">{formatSliderValue(maxDriveHours, " hrs")}</span>
                </div>
                <input
                  type="range"
                  className="tour-slider"
                  value={maxDriveHours}
                  onChange={(e) => setMaxDriveHours(parseInt(e.target.value))}
                  min="1"
                  max="24"
                  step="1"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group">
                <label>Preferred Genres</label>
                <input
                  type="text"
                  value={preferredGenres}
                  onChange={(e) => setPreferredGenres(e.target.value)}
                  placeholder="rock, indie, alternative"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group tour-slider-group">
                <div className="tour-slider-label">
                  <span>Min Venue Capacity</span>
                  <span className="tour-slider-value">{formatSliderValue(minVenueCapacity)}</span>
                </div>
                <input
                  type="range"
                  className="tour-slider"
                  value={minVenueCapacity}
                  onChange={(e) => setMinVenueCapacity(parseInt(e.target.value))}
                  min="10"
                  max="10000"
                  step="50"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group tour-slider-group">
                <div className="tour-slider-label">
                  <span>Max Venue Capacity</span>
                  <span className="tour-slider-value">{formatSliderValue(maxVenueCapacity)}</span>
                </div>
                <input
                  type="range"
                  className="tour-slider"
                  value={maxVenueCapacity}
                  onChange={(e) => setMaxVenueCapacity(parseInt(e.target.value))}
                  min="50"
                  max="50000"
                  step="100"
                  disabled={generating || regenerating}
                />
              </div>

              <div className="tour-form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={prioritizeWeekends}
                    onChange={(e) => setPrioritizeWeekends(e.target.checked)}
                    disabled={generating || regenerating}
                  />
                  Prioritize Weekend Shows
                </label>
              </div>
            </div>

            <div className="tour-advanced-section">
              <div 
                className="tour-advanced-header"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <div className="tour-advanced-title">
                  <span>⚙️</span>
                  <span>Advanced Algorithm Weights</span>
                </div>
                <span className={`tour-advanced-icon ${showAdvanced ? 'expanded' : ''}`}>▼</span>
              </div>

              {showAdvanced && (
                <div className="tour-advanced-content">
                  <div className="tour-weights-grid">
                    <div className="tour-weight-group">
                      <div className="tour-weight-header">Scoring Weights</div>
                      
                      <div className="tour-slider-group">
                        <div className="tour-slider-label">
                          <span>Genre Match Importance</span>
                          <span className="tour-slider-value">{(algorithmWeights.genreMatchWeight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="tour-weight-description">
                          How much to prioritize events matching your preferred genres
                        </div>
                        <input
                          type="range"
                          className="tour-slider"
                          value={algorithmWeights.genreMatchWeight}
                          onChange={(e) => handleWeightChange('genreMatchWeight', parseFloat(e.target.value))}
                          min="0"
                          max="1"
                          step="0.05"
                          disabled={generating || regenerating}
                        />
                      </div>

                      <div className="tour-slider-group">
                        <div className="tour-slider-label">
                          <span>Capacity Match Importance</span>
                          <span className="tour-slider-value">{(algorithmWeights.capacityMatchWeight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="tour-weight-description">
                          How much to prioritize venues matching your capacity preferences
                        </div>
                        <input
                          type="range"
                          className="tour-slider"
                          value={algorithmWeights.capacityMatchWeight}
                          onChange={(e) => handleWeightChange('capacityMatchWeight', parseFloat(e.target.value))}
                          min="0"
                          max="1"
                          step="0.05"
                          disabled={generating || regenerating}
                        />
                      </div>

                      <div className="tour-slider-group">
                        <div className="tour-slider-label">
                          <span>Distance Optimization</span>
                          <span className="tour-slider-value">{(algorithmWeights.distanceWeight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="tour-weight-description">
                          How much to minimize travel distance between shows
                        </div>
                        <input
                          type="range"
                          className="tour-slider"
                          value={algorithmWeights.distanceWeight}
                          onChange={(e) => handleWeightChange('distanceWeight', parseFloat(e.target.value))}
                          min="0"
                          max="1"
                          step="0.05"
                          disabled={generating || regenerating}
                        />
                      </div>

                      <div className="tour-slider-group">
                        <div className="tour-slider-label">
                          <span>Weekend Preference</span>
                          <span className="tour-slider-value">{(algorithmWeights.weekendPreferenceWeight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="tour-weight-description">
                          How much to prioritize weekend shows when enabled
                        </div>
                        <input
                          type="range"
                          className="tour-slider"
                          value={algorithmWeights.weekendPreferenceWeight}
                          onChange={(e) => handleWeightChange('weekendPreferenceWeight', parseFloat(e.target.value))}
                          min="0"
                          max="1"
                          step="0.05"
                          disabled={generating || regenerating || !prioritizeWeekends}
                        />
                      </div>

                      <div className="tour-slider-group">
                        <div className="tour-slider-label">
                          <span>Recommendation Score</span>
                          <span className="tour-slider-value">{(algorithmWeights.recommendationScoreWeight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="tour-weight-description">
                          How much to rely on collaborative filtering and past success data
                        </div>
                        <input
                          type="range"
                          className="tour-slider"
                          value={algorithmWeights.recommendationScoreWeight}
                          onChange={(e) => handleWeightChange('recommendationScoreWeight', parseFloat(e.target.value))}
                          min="0"
                          max="1"
                          step="0.05"
                          disabled={generating || regenerating}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {availabilitySummary && (
              <div className="tour-availability-summary">
                <h3>Availability Summary</h3>
                <div className="availability-stats">
                  <div className="availability-stat">
                    <span className="stat-label">Available Days:</span>
                    <span className="stat-value">{availabilitySummary.availability_summary.available_days}</span>
                  </div>
                  <div className="availability-stat">
                    <span className="stat-label">Unavailable Days:</span>
                    <span className="stat-value">{availabilitySummary.availability_summary.unavailable_days}</span>
                  </div>
                  <div className="availability-stat">
                    <span className="stat-label">Weekend Availability:</span>
                    <span className="stat-value">
                      {availabilitySummary.weekend_availability.weekend_availability_percentage}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="tour-form-actions">
              <button
                className="tour-generate-button"
                onClick={() => handleGenerateTour(false)}
                disabled={generating || regenerating}
              >
                {generating ? "Generating..." : "Generate Tour"}
              </button>
            </div>
          </div>
        )}

        {tourResults && (
          <div className="tour-results">
            <div className="tour-summary">
              <h3>Tour Summary</h3>
              <div className="tour-summary-stats">
                <div className="tour-stat">
                  <span className="tour-stat-value">{tourResults.tour_summary.total_show_days}</span>
                  <span className="tour-stat-label">Shows</span>
                </div>
                <div className="tour-stat">
                  <span className="tour-stat-value">{tourResults.tour_summary.total_distance_km}</span>
                  <span className="tour-stat-label">km Total</span>
                </div>
                <div className="tour-stat">
                  <span className="tour-stat-value">{tourResults.tour_summary.total_travel_days}</span>
                  <span className="tour-stat-label">Travel Days</span>
                </div>
                <div className="tour-stat">
                  <span className="tour-stat-value">{tourResults.tour_summary.tour_efficiency_score}%</span>
                  <span className="tour-stat-label">Efficiency</span>
                </div>
              </div>
            </div>

            {tourResults.routing_warnings && tourResults.routing_warnings.length > 0 && (
              <div className="tour-warnings">
                <h3>⚠️ Routing Warnings</h3>
                {tourResults.routing_warnings.map((warning, idx) => (
                  <div key={idx} className="tour-warning">{warning}</div>
                ))}
              </div>
            )}

            <div className="tour-timeline">
              <h3>Tour Route</h3>
              <div className="tour-stops">
                {[...tourResults.recommended_events, ...tourResults.recommended_venues]
                  .sort((a, b) => {
                    // Parse dates manually to avoid timezone issues
                    const parseDate = (dateString) => {
                      if (!dateString) return new Date(0);
                      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
                      return new Date(year, month - 1, day);
                    };
                    const dateA = parseDate(a.event_date || a.suggested_date);
                    const dateB = parseDate(b.event_date || b.suggested_date);
                    return dateA - dateB;
                  })
                  .map((item, index) => 
                    renderTourStop(item, index, item.event_date !== undefined)
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TourGenerator;
