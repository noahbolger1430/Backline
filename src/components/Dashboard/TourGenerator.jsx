import React, { useState, useEffect, useCallback, useRef } from "react";
import { tourService } from "../../services/tourService";
import { eventApplicationService } from "../../services/eventApplicationService";
import { getImageUrl } from "../../utils/imageUtils";
import GigApplicationModal from "./GigApplicationModal";
import TourAddStopModal from "./TourAddStopModal";
import VenueSwapModal from "./VenueSwapModal";
import "./TourGenerator.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const TourGenerator = ({ bandId, onBack }) => {
  const [view, setView] = useState("landing"); // "landing", "generate", "saved"
  const [savedTours, setSavedTours] = useState([]);
  const [loadingSavedTours, setLoadingSavedTours] = useState(false);
  const [selectedTour, setSelectedTour] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [tourName, setTourName] = useState("");
  const [savingTour, setSavingTour] = useState(false);
  
  // Application modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [appliedEventIds, setAppliedEventIds] = useState(new Set());
  const [applicationStatuses, setApplicationStatuses] = useState({});
  
  // Venue swap modal state
  const [venueToSwap, setVenueToSwap] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [showAddStopModal, setShowAddStopModal] = useState(false);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tourRadius, setTourRadius] = useState(1000);
  const [startingLocation, setStartingLocation] = useState("");
  const [minDaysBetweenShows, setMinDaysBetweenShows] = useState(0);
  const [maxDaysBetweenShows, setMaxDaysBetweenShows] = useState(7);
  const [maxDriveHours, setMaxDriveHours] = useState(8);
  const [prioritizeWeekends, setPrioritizeWeekends] = useState(true);
  const [includeBookedEvents, setIncludeBookedEvents] = useState(false);
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
    if (view === "landing") {
      fetchSavedTours();
    }
  }, [view]);

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
    if (startDate && endDate && bandId && view === "generate") {
      fetchAvailabilitySummary();
    }
  }, [startDate, endDate, bandId, view]);

  // Fetch band's existing applications when tour results are loaded
  useEffect(() => {
    if (tourResults && bandId) {
      fetchBandApplications();
    }
  }, [tourResults, bandId]);

  const fetchBandApplications = async () => {
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
    } catch (err) {
      console.warn("Could not fetch band applications:", err);
    }
  };

  const fetchSavedTours = async () => {
    try {
      setLoadingSavedTours(true);
      const tours = await tourService.getSavedTours(bandId);
      setSavedTours(tours);
    } catch (err) {
      console.error("Failed to fetch saved tours:", err);
    } finally {
      setLoadingSavedTours(false);
    }
  };

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
        include_booked_events: includeBookedEvents,
        preferred_genres: genreList,
        preferred_venue_capacity_min: minVenueCapacity,
        preferred_venue_capacity_max: maxVenueCapacity,
        algorithm_weights: algorithmWeights,
      };

      console.log('Tour params being sent:', { ...tourParams, include_booked_events: includeBookedEvents });
      const results = await tourService.generateTour(bandId, tourParams);
      setTourResults(results);
      setHasUnsavedChanges(false);
      if (!isRegeneration) {
        setShowSettings(false);
        if (!selectedTour) {
          setSelectedTour(null);
        }
      }
    } catch (err) {
      console.error("Failed to generate tour:", err);
      setError(err.message || "Failed to generate tour");
    } finally {
      setGenerating(false);
      setRegenerating(false);
    }
  }, [startDate, endDate, tourRadius, startingLocation, minDaysBetweenShows, 
      maxDaysBetweenShows, maxDriveHours, prioritizeWeekends, includeBookedEvents, preferredGenres, 
      minVenueCapacity, maxVenueCapacity, algorithmWeights, bandId, selectedTour]);

  const handleWeightChange = useCallback((weightKey, value) => {
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

  const handleSaveTour = async () => {
    if (!tourName.trim()) {
      return;
    }

    try {
      setSavingTour(true);
      
      if (selectedTour) {
        const updatedTour = await tourService.updateSavedTour(
          bandId, 
          selectedTour.id, 
          tourName.trim(), 
          tourResults
        );
        setSelectedTour(updatedTour);
        setTourResults(updatedTour.tour_results);
      } else {
        const tempTourId = Date.now().toString();
        await tourService.saveTour(bandId, tempTourId, tourName.trim(), tourResults);
      }
      
      setShowSaveModal(false);
      setTourName("");
      setHasUnsavedChanges(false);
      fetchSavedTours();
      alert(selectedTour ? "Tour updated successfully!" : "Tour saved successfully!");
    } catch (err) {
      console.error("Failed to save tour:", err);
      alert("Failed to save tour: " + err.message);
    } finally {
      setSavingTour(false);
    }
  };

  const handleViewSavedTour = async (tourId) => {
    try {
      setLoadingSavedTours(true);
      const tour = await tourService.getSavedTour(bandId, tourId);
      setTourResults(tour.tour_results);
      setView("generate");
      setShowSettings(true);
      setSelectedTour(tour);
      setHasUnsavedChanges(false);
      
      if (tour.tour_params) {
        if (tour.tour_params.start_date) {
          setStartDate(tour.tour_params.start_date);
        }
        if (tour.tour_params.end_date) {
          setEndDate(tour.tour_params.end_date);
        }
        if (tour.tour_params.tour_radius_km) {
          setTourRadius(tour.tour_params.tour_radius_km);
        }
        if (tour.tour_params.starting_location) {
          setStartingLocation(tour.tour_params.starting_location);
        }
        if (tour.tour_params.include_booked_events !== undefined) {
          setIncludeBookedEvents(tour.tour_params.include_booked_events);
        }
      }
    } catch (err) {
      console.error("Failed to load tour:", err);
      alert("Failed to load tour: " + err.message);
    } finally {
      setLoadingSavedTours(false);
    }
  };

  const handleDeleteSavedTour = async (tourId, e) => {
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to delete this saved tour?")) {
      return;
    }

    try {
      await tourService.deleteSavedTour(bandId, tourId);
      fetchSavedTours();
    } catch (err) {
      console.error("Failed to delete tour:", err);
      alert("Failed to delete tour: " + err.message);
    }
  };

  const handleEventClick = (event) => {
    // Check if this event is open for applications and band hasn't applied yet
    if (event.is_open_for_applications && !appliedEventIds.has(event.event_id)) {
      // Convert tour event to modal-compatible format
      setSelectedEvent({
        id: event.event_id,
        name: event.event_name,
        description: event.description,
        event_date: event.event_date,
        doors_time: event.doors_time,
        show_time: event.show_time,
        is_ticketed: event.is_ticketed,
        ticket_price: event.ticket_price,
        is_age_restricted: event.is_age_restricted,
        age_restriction: event.age_restriction,
        image_path: event.image_path,
        is_recurring: event.is_recurring,
        recurring_frequency: event.recurring_frequency,
        venue_id: event.venue_id,
        venue_name: event.venue_name,
        status: "pending",
        is_open_for_applications: true,
      });
    }
  };

  const handleVenueClick = (venue) => {
    setVenueToSwap(venue);
  };

  const handleVenueSwap = async (currentVenue, newVenue, suggestedDate) => {
    if (!tourResults) {
      console.error("handleVenueSwap: No tourResults available");
      return;
    }
  
    console.log("handleVenueSwap called with:", {
      currentVenue,
      newVenue,
      suggestedDate,
      bandId,
      hasRecommendedVenues: tourResults.recommended_venues?.length
    });
  
    try {
      // Show a loading indicator while calculating
      setRegenerating(true);
  
      // Sort all stops by date to find previous and next stops
      const allStops = [
        ...(tourResults.booked_events || []),
        ...tourResults.recommended_events,
        ...tourResults.recommended_venues
      ].sort((a, b) => {
        const parseDate = (dateString) => {
          if (!dateString) return new Date(0);
          const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        return parseDate(a.event_date || a.suggested_date) - parseDate(b.event_date || b.suggested_date);
      });
  
      console.log("All stops sorted:", allStops.map(s => ({
        venue_id: s.venue_id,
        date: s.event_date || s.suggested_date,
        venue_name: s.venue_name
      })));
  
      // Find the current stop's index - handle both date formats
      const normalizeDate = (dateStr) => {
        if (!dateStr) return null;
        return dateStr.split('T')[0];
      };
  
      const targetDate = normalizeDate(suggestedDate);
      const currentStopIndex = allStops.findIndex(stop => {
        const stopDate = normalizeDate(stop.suggested_date || stop.event_date);
        return stop.venue_id === currentVenue.venue_id && stopDate === targetDate;
      });
  
      console.log("Current stop index:", currentStopIndex, "Target date:", targetDate);
  
      // Get previous and next stops
      const previousStop = currentStopIndex > 0 ? allStops[currentStopIndex - 1] : null;
      const nextStop = currentStopIndex < allStops.length - 1 ? allStops[currentStopIndex + 1] : null;
  
      console.log("Previous stop:", previousStop?.venue_name, "Next stop:", nextStop?.venue_name);
  
      // Build the request for the API
      const distanceRequest = {
        band_id: bandId,
        new_venue_id: newVenue.id,
        suggested_date: targetDate,
      };
  
      // Add previous stop info if available
      if (previousStop) {
        distanceRequest.previous_stop_venue_id = previousStop.venue_id;
        distanceRequest.previous_stop_date = normalizeDate(previousStop.event_date || previousStop.suggested_date);
      }
  
      // Add next stop info if available
      if (nextStop) {
        distanceRequest.next_stop_venue_id = nextStop.venue_id;
        distanceRequest.next_stop_date = normalizeDate(nextStop.event_date || nextStop.suggested_date);
      }
  
      console.log("Distance request:", distanceRequest);
  
      // Call the API to calculate distances
      let distanceResult;
      try {
        distanceResult = await tourService.calculateVenueSwapDistance(distanceRequest);
        console.log("Distance result from API:", distanceResult);
        
        // Validate that we got valid distance data
        if (!distanceResult) {
          console.error("Empty distance result from API");
          throw new Error("Empty distance calculation result");
        }
        
        if (distanceResult.distance_from_previous_km === undefined || 
            distanceResult.distance_from_home_km === undefined) {
          console.error("Invalid distance result from API - missing fields:", distanceResult);
          throw new Error("Invalid distance calculation result - missing required fields");
        }
        
        // Ensure numeric values
        distanceResult.distance_from_previous_km = Number(distanceResult.distance_from_previous_km) || 0;
        distanceResult.distance_from_home_km = Number(distanceResult.distance_from_home_km) || 0;
        distanceResult.travel_days_needed = Number(distanceResult.travel_days_needed) || 0;
        
        console.log("Validated distance result:", distanceResult);
      } catch (err) {
        console.error("Error calculating distances from API:", err);
        console.error("Error details:", {
          message: err.message,
          status: err.status,
          response: err.response
        });
        
        // Last resort: use old venue distances but warn the user
        console.warn("Using fallback distances from current venue");
        distanceResult = {
          distance_from_home_km: currentVenue.distance_from_home_km || 0,
          distance_from_previous_km: currentVenue.distance_from_previous_km || 0,
          travel_days_needed: currentVenue.travel_days_needed || 0,
          routing_note: "Distance calculation unavailable - showing previous values. Please try again."
        };
        // Don't show alert as it's disruptive - the fallback values will be used
      }
  
      // Calculate day of week from suggested date
      const getDayOfWeek = (dateString) => {
        if (!dateString) return "Unknown";
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString("en-US", { weekday: "long" });
      };
  
      // Build reasoning array
      const reasoning = [
        "Manually selected as replacement venue",
        distanceResult.routing_note,
      ];
      if (newVenue.capacity) {
        reasoning.push(`Venue capacity: ${newVenue.capacity}`);
      }
      if (newVenue.is_favorited) {
        reasoning.push("Favorited venue");
      }
      if (newVenue.has_sound_provided) {
        reasoning.push("Sound system provided");
      }
      if (newVenue.has_parking) {
        reasoning.push("Parking available");
      }
  
      // Create the new venue recommendation object with calculated distances
      const newVenueRecommendation = {
        venue_id: newVenue.id,
        venue_name: newVenue.name,
        venue_location: [newVenue.city, newVenue.state].filter(Boolean).join(", ") || "Location not specified",
        venue_capacity: newVenue.capacity || null,
        has_sound_provided: newVenue.has_sound_provided || false,
        has_parking: newVenue.has_parking || false,
        venue_contact_name: newVenue.contact_name || null,
        venue_contact_email: newVenue.contact_email || null,
        venue_contact_phone: newVenue.contact_phone || null,
        suggested_date: targetDate, // Use normalized date
        day_of_week: getDayOfWeek(targetDate),
        booking_priority: currentVenue.booking_priority || "medium",
        distance_from_previous_km: distanceResult.distance_from_previous_km,
        distance_from_home_km: distanceResult.distance_from_home_km,
        travel_days_needed: distanceResult.travel_days_needed,
        score: currentVenue.score || 50,
        availability_status: "unknown",
        reasoning: reasoning.filter(Boolean),
        image_path: newVenue.image_path || null,
      };
  
      console.log("New venue recommendation:", newVenueRecommendation);
  
      // Update the tour results with the swapped venue
      // Create a completely new array to ensure React detects the change
      const updatedVenues = tourResults.recommended_venues.map((v) => {
        const vDate = normalizeDate(v.suggested_date);
        if (v.venue_id === currentVenue.venue_id && vDate === targetDate) {
          console.log("Found venue to replace:", v.venue_name, "->", newVenue.name);
          return { ...newVenueRecommendation }; // Spread to create new object
        }
        return { ...v }; // Spread to create new object for each venue
      });
  
      // Calculate the distance difference for tour summary update
      const oldDistanceFromPrevious = currentVenue.distance_from_previous_km || 0;
      const newDistanceFromPrevious = distanceResult.distance_from_previous_km;
      const distanceDiff = newDistanceFromPrevious - oldDistanceFromPrevious;
  
      console.log("Distance diff:", distanceDiff, "(old:", oldDistanceFromPrevious, "new:", newDistanceFromPrevious, ")");
  
      // Update total distance in tour summary
      const newTotalDistance = Math.max(0, 
        Math.round((tourResults.tour_summary.total_distance_km + distanceDiff) * 10) / 10
      );
  
      // Recalculate average
      const newAverage = tourResults.tour_summary.total_show_days > 0
        ? Math.round((newTotalDistance / tourResults.tour_summary.total_show_days) * 10) / 10
        : 0;
  
      // Create a completely new tourResults object to ensure React re-renders
      const newTourResults = {
        ...tourResults,
        recommended_venues: updatedVenues,
        recommended_events: [...tourResults.recommended_events], // New array reference
        booked_events: tourResults.booked_events ? [...tourResults.booked_events] : [],
        tour_summary: {
          ...tourResults.tour_summary,
          total_distance_km: newTotalDistance,
          average_km_between_shows: newAverage,
        }
      };
  
      console.log("Setting new tour results, total_distance_km:", newTotalDistance);
  
      setTourResults(newTourResults);
      setVenueToSwap(null);
      setHasUnsavedChanges(true);
  
      console.log("Venue swap completed successfully");
    } catch (err) {
      console.error("Error swapping venue:", err);
      alert("Failed to swap venue: " + err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCloseVenueSwapModal = () => {
    setVenueToSwap(null);
  };

  const handleCloseApplicationModal = () => {
    setSelectedEvent(null);
  };

  const handleApplicationSubmitted = () => {
    setSelectedEvent(null);
    // Refresh application statuses
    fetchBandApplications();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleAddStopClick = () => {
    setShowAddStopModal(true);
  };
  
  const handleAddStopTypeSelected = (type) => {
    // TODO: Implement the actual functionality to add events
    console.log(`Selected to add ${type}`);
    // This is where you'll implement the event selection logic
    // For now, we're just logging the selection
  };
  
  const handleAddVenueToTour = (venue, date) => {
    // Create a venue recommendation object that matches the tour stop format
    const newVenueStop = {
      venue_id: venue.id,
      venue_name: venue.name,
      venue_location: formatLocation(venue),
      venue_contact_name: venue.contact_name,
      venue_contact_email: venue.contact_email,
      venue_contact_phone: venue.contact_phone,
      suggested_date: date,
      distance_from_previous_km: 0, // Will be calculated if needed
      travel_days_needed: 0,
      booking_priority: "manual",
      reasoning: ["Manually added to tour"],
      image_path: venue.image_path,
      capacity: venue.capacity,
    };
  
    // Add the venue to the tour results
    setTourResults(prev => ({
      ...prev,
      recommended_venues: [...prev.recommended_venues, newVenueStop]
    }));
  
    // Close the modal
    setShowAddStopModal(false);
  };

  // Helper function to format location
  const formatLocation = (venue) => {
    const parts = [];
    if (venue.city) parts.push(venue.city);
    if (venue.state) parts.push(venue.state);
    return parts.join(", ") || "Location not specified";
  };

  // Update the modal component props
  {showAddStopModal && (
    <TourAddStopModal
      isOpen={showAddStopModal}
      onClose={() => setShowAddStopModal(false)}
      onSelectType={handleAddStopTypeSelected}
      bandId={bandId}
      tourParams={{
        preferred_venue_capacity_min: minVenueCapacity,
        preferred_venue_capacity_max: maxVenueCapacity,
      }}
      onAddVenue={handleAddVenueToTour}
      startDate={startDate}
      endDate={endDate}
    />
  )}

  const formatDayOfWeek = (dateString) => {
    if (!dateString) return "";
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
    return `${value.toLocaleString()}${suffix}`;
  };

  const getApplicationStatusBadge = (eventId) => {
    if (!eventId) return null;
    
    const hasApplied = appliedEventIds.has(eventId);
    if (!hasApplied) return null;

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
      <span className={`tour-tag ${badgeClass}`}>
        {badgeText}
      </span>
    );
  };

  // Get current tour params for the venue swap modal
  const getCurrentTourParams = () => ({
    preferred_venue_capacity_min: minVenueCapacity,
    preferred_venue_capacity_max: maxVenueCapacity,
  });

  const renderTourStop = (item, index, isEvent) => {
    const date = isEvent ? item.event_date : item.suggested_date;
    const priorityColor = getPriorityColor(item.priority || item.booking_priority);
    const hasApplied = isEvent && appliedEventIds.has(item.event_id);
    const canApply = isEvent && item.is_open_for_applications && !hasApplied;
    
    return (
      <div key={`stop-${index}`} className="tour-stop">
        <div className="tour-date">
          <div className="tour-date-text">{formatDate(date)}</div>
          <div className="tour-day-text">{formatDayOfWeek(date)}</div>
        </div>
        
        <div className="tour-timeline-connector">
          <div className="tour-timeline-dot" style={{ backgroundColor: priorityColor }}></div>
          {index < (tourResults.recommended_events.length + tourResults.recommended_venues.length + (tourResults.booked_events?.length || 0) - 1) && (
            <div className="tour-timeline-line"></div>
          )}
        </div>

        {isEvent ? (
          <div 
            className={`tour-stop-card event ${canApply ? "clickable" : ""}`}
            onClick={() => canApply && handleEventClick(item)}
            style={{ cursor: canApply ? "pointer" : "default" }}
            role={canApply ? "button" : undefined}
            tabIndex={canApply ? 0 : undefined}
            onKeyDown={(e) => {
              if (canApply && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleEventClick(item);
              }
            }}
          >
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
                {item.is_open_for_applications && !hasApplied && (
                  <span className="tour-tag accepting">Open for Applications</span>
                )}
                {hasApplied && getApplicationStatusBadge(item.event_id)}
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
                    🚗 {item.travel_days_needed} travel day{item.travel_days_needed > 1 ? "s" : ""}
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
              
              {canApply && (
                <div className="tour-stop-apply-hint">
                  Click to apply →
                </div>
              )}
            </div>
          </div>
        ) : (
          <div 
            className="tour-stop-card venue clickable"
            onClick={() => handleVenueClick(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleVenueClick(item);
              }
            }}
          >
            <div className="tour-stop-image venue">
              {item.image_path ? (
                <img
                  src={getImageUrl(item.image_path, API_BASE_URL)}
                  alt={item.venue_name}
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
                🏛️
              </span>
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
                    <div className="contact-item">📱 {item.venue_contact_phone}</div>
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
                    🚗 {item.travel_days_needed} travel day{item.travel_days_needed > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              
              <div className="tour-stop-reasons">
                {item.reasoning.slice(0, 3).map((reason, idx) => (
                  <span key={idx} className="tour-reason">{reason}</span>
                ))}
              </div>

              <div className="tour-stop-swap-hint">
                Click to swap venue →
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (view === "landing") {
    return (
      <div className="tour-generator-container">
        <div className="tour-generator-main-header">
          <button className="tour-back-button" onClick={onBack}>
            <span className="tour-back-arrow">←</span>
            Back
          </button>
          <h2 className="tour-generator-main-title">Tour Generator</h2>
          <div style={{ width: "73px" }}></div>
        </div>

        <div className="tour-generator-landing">
          <div className="tour-options-container">
            <div 
              className="tour-option-card"
              onClick={() => {
                setView("generate");
                setTourResults(null);
                setSelectedTour(null);
                setHasUnsavedChanges(false);
              }}
            >
              <div className="tour-option-icon">✨</div>
              <h3 className="tour-option-title">Generate New Tour</h3>
              <p className="tour-option-description">
                Create an optimized tour route based on your preferences
              </p>
            </div>
          </div>

          {savedTours.length > 0 && (
            <div className="saved-tours-section">
              <div className="saved-tours-header">
                <h3 className="saved-tours-title">Recent Tours</h3>
              </div>
              <div className="saved-tours-list">
                {savedTours.slice(0, 3).map(tour => (
                  <div 
                    key={tour.id}
                    className="saved-tour-item"
                    onClick={() => handleViewSavedTour(tour.id)}
                  >
                    <div className="saved-tour-info">
                      <h4 className="saved-tour-name">{tour.name}</h4>
                      <div className="saved-tour-details">
                        <span className="saved-tour-detail">
                          📅 {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                        </span>
                        <span className="saved-tour-detail">
                          🎵 {tour.total_shows} shows
                        </span>
                        <span className="saved-tour-detail">
                          🚗 {Math.round(tour.total_distance_km)} km
                        </span>
                      </div>
                    </div>
                    <div className="saved-tour-actions">
                      <button 
                        className="saved-tour-button delete"
                        onClick={(e) => handleDeleteSavedTour(tour.id, e)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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
        <button className="tour-back-button" onClick={() => setView("landing")}>
          <span className="tour-back-arrow">←</span>
          Back
        </button>
        <h2 className="tour-generator-title">
          {selectedTour ? `Saved Tour: ${selectedTour.name}` : "Tour Generator"}
          {hasUnsavedChanges && <span style={{ color: '#FFA500', marginLeft: '8px' }}>*</span>}
        </h2>
        <div className="tour-action-buttons">
          {tourResults && (
            <button 
              className="tour-settings-button"
              onClick={() => {
                if (selectedTour) {
                  setTourName(selectedTour.name);
                }
                setShowSaveModal(true);
              }}
              style={{ marginRight: "12px" }}
            >
              {selectedTour ? (hasUnsavedChanges ? "Save Changes*" : "Save Changes") : "Save Tour"}
            </button>
          )}
          {tourResults && (
            <button 
              className="tour-settings-button"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? "Hide Settings" : "Show Settings"}
            </button>
          )}
        </div>
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

              <div className="tour-form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={includeBookedEvents}
                    onChange={(e) => setIncludeBookedEvents(e.target.checked)}
                    disabled={generating || regenerating}
                  />
                  Include Booked Events
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
                {generating ? "Generating..." : selectedTour ? "Regenerate Tour" : "Generate Tour"}
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
                {[...(tourResults.booked_events || []), ...tourResults.recommended_events, ...tourResults.recommended_venues]
                  .sort((a, b) => {
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
              <div className="tour-new-stop-container">
                <div className="tour-new-stop-spacer"></div>
                <div className="tour-new-stop-connector"></div>
                <button
                  className="tour-new-stop-button"
                  onClick={handleAddStopClick}
                >
                  <span className="tour-new-stop-icon">+</span>
                  <span>Add Tour Stop</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showSaveModal && (
        <div className="tour-save-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="tour-save-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tour-save-modal-header">Save Tour</h3>
            <input
              type="text"
              className="tour-save-modal-input"
              placeholder="Enter tour name..."
              value={tourName}
              onChange={(e) => setTourName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveTour()}
            />
            <div className="tour-save-modal-actions">
              <button
                className="tour-cancel-button"
                onClick={() => {
                  setShowSaveModal(false);
                  setTourName("");
                }}
              >
                Cancel
              </button>
              <button
                className="tour-save-button"
                onClick={handleSaveTour}
                disabled={!tourName.trim() || savingTour}
              >
                {savingTour ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <GigApplicationModal
          event={selectedEvent}
          bandId={bandId}
          onClose={handleCloseApplicationModal}
          onApplicationSubmitted={handleApplicationSubmitted}
        />
      )}

      {venueToSwap && (
        <VenueSwapModal
          currentVenue={venueToSwap}
          suggestedDate={venueToSwap.suggested_date}
          bandId={bandId}
          onClose={handleCloseVenueSwapModal}
          onSwap={handleVenueSwap}
          tourParams={getCurrentTourParams()}
        />
      )}
      {showAddStopModal && (
        <TourAddStopModal
          isOpen={showAddStopModal}
          onClose={() => setShowAddStopModal(false)}
          onSelectType={handleAddStopTypeSelected}
          bandId={bandId}
          tourParams={{
            preferred_venue_capacity_min: minVenueCapacity,
            preferred_venue_capacity_max: maxVenueCapacity,
          }}
          onAddVenue={handleAddVenueToTour}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
};

export default TourGenerator;
