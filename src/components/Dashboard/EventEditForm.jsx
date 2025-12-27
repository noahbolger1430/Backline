import React, { useState, useEffect } from "react";
import { eventService } from "../../services/eventService";
import { stagePlotService } from "../../services/stagePlotService";
import { bandService } from "../../services/bandService";
import BandSearchSelect from "./BandSearchSelect";
import StagePlot from "./StagePlot";
import EventApplicationsList from "./EventApplicationsList";
import "./EventEditForm.css";

const EventEditForm = ({ event, onUpdate, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_date: "",
    doors_time: "",
    show_time: "",
    status: "confirmed",
    is_open_for_applications: false,
    is_ticketed: false,
    ticket_price: "",
    is_age_restricted: false,
    age_restriction: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [eventBands, setEventBands] = useState([]);
  const [loadingBands, setLoadingBands] = useState(false);
  const [selectedBandsToAdd, setSelectedBandsToAdd] = useState([]);
  const [applicationActionLoading, setApplicationActionLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [viewingStagePlot, setViewingStagePlot] = useState(null); // { bandId, bandName, stagePlotId, plotName }
  const [selectedBand, setSelectedBand] = useState(null); // Full band details for modal
  const [bandModalLoading, setBandModalLoading] = useState(false);
  const [bandModalError, setBandModalError] = useState(null);

  useEffect(() => {
    if (event) {
      // Format date for input (YYYY-MM-DD)
      const eventDate = event.event_date ? event.event_date.split('T')[0] : "";
      
      // Format time for input (HH:MM)
      const formatTimeForInput = (timeString) => {
        if (!timeString) return "";
        // If time is already in HH:MM format, use it; otherwise parse it
        if (timeString.includes(":")) {
          return timeString.substring(0, 5); // Take HH:MM part
        }
        return timeString;
      };

      setFormData({
        name: event.name || "",
        description: event.description || "",
        event_date: eventDate,
        doors_time: formatTimeForInput(event.doors_time),
        show_time: formatTimeForInput(event.show_time),
        status: event.status || "confirmed",
        is_open_for_applications: event.is_open_for_applications || false,
        is_ticketed: event.is_ticketed || false,
        ticket_price: event.ticket_price ? (event.ticket_price / 100).toFixed(2) : "",
        is_age_restricted: event.is_age_restricted || false,
        age_restriction: event.age_restriction ? String(parseInt(event.age_restriction, 10)) : "",
      });

      // Set current image preview if image exists
      if (event.image_path) {
        // Construct image URL - adjust based on your API base URL
        const apiBaseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
        setImagePreview(`${apiBaseUrl}/${event.image_path}`);
      } else {
        setImagePreview(null);
      }
      setImageFile(null);

      // Fetch event bands
      fetchEventBands();
    }
  }, [event]);

  const fetchEventBands = async () => {
    if (!event?.id) return;
    try {
      setLoadingBands(true);
      const bands = await eventService.getEventBands(event.id);
      setEventBands(bands || []);
    } catch (err) {
      console.error("Error fetching event bands:", err);
      setEventBands([]);
    } finally {
      setLoadingBands(false);
    }
  };

  const handleAddBands = async () => {
    if (selectedBandsToAdd.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      for (const band of selectedBandsToAdd) {
        await eventService.addBandToEvent(event.id, band.id);
      }
      setSelectedBandsToAdd([]);
      await fetchEventBands();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message || "Failed to add bands");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBand = async (bandId) => {
    if (!window.confirm("Are you sure you want to remove this band from the event?")) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await eventService.removeBandFromEvent(event.id, bandId);
      await fetchEventBands();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message || "Failed to remove band");
    } finally {
      setLoading(false);
    }
  };

  const handleBandCardClick = async (bandId) => {
    setBandModalLoading(true);
    setBandModalError(null);
    setSelectedBand(null);
    
    try {
      const bandDetails = await bandService.getBandDetails(bandId);
      setSelectedBand(bandDetails);
    } catch (err) {
      setBandModalError(err.message || "Failed to load band details");
      console.error("Error fetching band details:", err);
    } finally {
      setBandModalLoading(false);
    }
  };

  const handleCloseBandModal = () => {
    setSelectedBand(null);
    setBandModalError(null);
  };

  // Check if Spotify URL is an iframe embed
  const isSpotifyIframe = (url) => {
    if (!url) return false;
    // Check if it contains iframe tag or is an embed URL
    return url.includes('<iframe') || url.includes('embed.spotify.com') || url.includes('open.spotify.com/embed');
  };

  // Extract iframe src from embed code or convert URL to embed format
  const getSpotifyEmbed = (spotifyUrl) => {
    if (!spotifyUrl) return null;
    
    // If it's already an iframe tag, extract the src
    if (spotifyUrl.includes('<iframe')) {
      const srcMatch = spotifyUrl.match(/src=["']([^"']+)["']/);
      if (srcMatch) {
        return srcMatch[1];
      }
      // Try to extract from full iframe code
      const fullMatch = spotifyUrl.match(/<iframe[^>]+src=["']([^"']+)["']/);
      if (fullMatch) {
        return fullMatch[1];
      }
    }
    
    // If it's already an embed URL, use it directly
    if (spotifyUrl.includes('embed.spotify.com') || spotifyUrl.includes('open.spotify.com/embed')) {
      // If it's a full URL, extract just the URL part
      if (spotifyUrl.startsWith('http')) {
        return spotifyUrl;
      }
      // If it's just the embed path, construct full URL
      if (spotifyUrl.startsWith('/embed')) {
        return `https://open.spotify.com${spotifyUrl}`;
      }
      return spotifyUrl;
    }
    
    // If it's a regular Spotify URL, convert to embed format
    // Spotify URLs like: https://open.spotify.com/artist/... or spotify:artist:...
    if (spotifyUrl.includes('open.spotify.com')) {
      // Replace /artist/, /album/, /track/, etc. with /embed/artist/, /embed/album/, etc.
      return spotifyUrl.replace(/open\.spotify\.com\/([^\/]+)/, 'open.spotify.com/embed/$1');
    }
    
    // If it's a spotify: URI, we can't easily convert to embed
    // Return null so it shows as a link instead
    if (spotifyUrl.startsWith('spotify:')) {
      return null;
    }
    
    return null;
  };

  const handleOpenApplications = async () => {
    setApplicationActionLoading(true);
    setError(null);
    
    try {
      await eventService.openEventForApplications(event.id);
      if (onUpdate) {
        onUpdate();
      }
      // Refresh event data
      const updatedEvent = await eventService.getEvent(event.id);
      setFormData(prev => ({
        ...prev,
        is_open_for_applications: updatedEvent.is_open_for_applications || false,
      }));
    } catch (err) {
      setError(err.message || "Failed to open event for applications");
    } finally {
      setApplicationActionLoading(false);
    }
  };

  const handleCloseApplications = async () => {
    setApplicationActionLoading(true);
    setError(null);
    
    try {
      await eventService.closeEventApplications(event.id);
      if (onUpdate) {
        onUpdate();
      }
      // Refresh event data
      const updatedEvent = await eventService.getEvent(event.id);
      setFormData(prev => ({
        ...prev,
        is_open_for_applications: updatedEvent.is_open_for_applications || false,
      }));
    } catch (err) {
      setError(err.message || "Failed to close event applications");
    } finally {
      setApplicationActionLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError("Please select an image file");
        return;
      }
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(null);

    try {
      // Clean and format data before sending
      // Convert ticket price from dollars to cents
      let ticketPriceInCents = null;
      if (formData.is_ticketed && formData.ticket_price && formData.ticket_price.trim() !== "") {
        const priceInDollars = parseFloat(formData.ticket_price);
        if (!isNaN(priceInDollars) && priceInDollars > 0) {
          ticketPriceInCents = Math.round(priceInDollars * 100);
        }
      }
      
      // Convert age restriction to integer
      let ageRestrictionInt = null;
      if (formData.is_age_restricted && formData.age_restriction && formData.age_restriction.trim() !== "") {
        const ageValue = parseInt(formData.age_restriction, 10);
        if (!isNaN(ageValue) && ageValue > 0) {
          ageRestrictionInt = ageValue;
        }
      }
      
      const updateData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        event_date: formData.event_date,
        doors_time: formData.doors_time && formData.doors_time.trim() ? formData.doors_time.trim() : null,
        show_time: formData.show_time && formData.show_time.trim() ? formData.show_time.trim() : null,
        status: formData.status,
        is_open_for_applications: formData.status === "pending" ? formData.is_open_for_applications : false,
        is_ticketed: formData.is_ticketed,
        ticket_price: ticketPriceInCents,
        is_age_restricted: formData.is_age_restricted,
        age_restriction: ageRestrictionInt,
      };
      
      console.log("EventEditForm - Sending update data:", {
        ticket_price_input: formData.ticket_price,
        ticket_price_cents: ticketPriceInCents,
        age_restriction_input: formData.age_restriction,
        age_restriction_int: ageRestrictionInt,
        is_ticketed: formData.is_ticketed,
        is_age_restricted: formData.is_age_restricted
      });
      
      // Validate required fields
      if (!updateData.name || updateData.name.length === 0) {
        setError("Event name is required");
        setLoading(false);
        return;
      }
      if (!updateData.show_time) {
        setError("Show time is required");
        setLoading(false);
        return;
      }

      // Handle image: if imageFile is "REMOVE", send removal flag, otherwise send the file
      let imageToSend = null;
      let shouldRemoveImage = false;
      if (imageFile === "REMOVE") {
        shouldRemoveImage = true;
      } else if (imageFile) {
        imageToSend = imageFile;
      }
      
      await eventService.updateEvent(event.id, updateData, imageToSend, shouldRemoveImage);
      setIsEditing(false);
      setImageFile(null);
      // Refresh image preview from updated event
      if (onUpdate) {
        onUpdate();
      }
      // Close the expanded section after successful update
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      setError(err.message || "Failed to update event");
    } finally {
      setLoading(false);
    }
  };

  if (!isEditing) {
    const handleRemoveImage = async (e) => {
      e.stopPropagation();
      if (window.confirm("Are you sure you want to remove this image?")) {
        try {
          setLoading(true);
          setError(null);
          // Send remove_image flag to backend
          await eventService.updateEvent(event.id, {}, null, true);
          setImagePreview(null);
          setImageFile(null);
          if (onUpdate) {
            onUpdate();
          }
        } catch (err) {
          setError(err.message || "Failed to remove image");
        } finally {
          setLoading(false);
        }
      }
    };

    // Helper functions to format date and time
    const formatDate = (dateString) => {
      if (!dateString) return "N/A";
      try {
        const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const options = { month: "long", day: "numeric", year: "numeric" };
        return date.toLocaleDateString("en-US", options);
      } catch (e) {
        return dateString;
      }
    };

    const formatTime = (timeString) => {
      if (!timeString) return null;
      try {
        const [hours, minutes] = timeString.split(":");
        const date = new Date();
        date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
        return date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (e) {
        return timeString;
      }
    };

    const formatPrice = (priceInCents) => {
      if (!priceInCents) return null;
      return `$${(priceInCents / 100).toFixed(2)}`;
    };

    return (
      <>
      <div className="event-edit-form-container">
        <div className="event-details-view">
          <div className="event-details-layout">
            <div className="event-details-left">
              <div className="event-detail-row">
                <span className="detail-label">Status:</span>
                <span className="detail-value">{event.status || "confirmed"}</span>
              </div>
              {event.description && (
                <div className="event-detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{event.description}</span>
                </div>
              )}
              <div className="event-detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{formatDate(event.event_date)}</span>
              </div>
              {event.doors_time && (
                <div className="event-detail-row">
                  <span className="detail-label">Doors:</span>
                  <span className="detail-value">{formatTime(event.doors_time)}</span>
                </div>
              )}
              {event.show_time && (
                <div className="event-detail-row">
                  <span className="detail-label">Show Time:</span>
                  <span className="detail-value">{formatTime(event.show_time)}</span>
                </div>
              )}
              {event.is_ticketed && event.ticket_price && (
                <div className="event-detail-row">
                  <span className="detail-label">Ticket Price:</span>
                  <span className="detail-value">{formatPrice(event.ticket_price)}</span>
                </div>
              )}
              {event.is_age_restricted && event.age_restriction && (
                <div className="event-detail-row">
                  <span className="detail-label">Age Restriction:</span>
                  <span className="detail-value">{event.age_restriction}+</span>
                </div>
              )}
              <div className="event-detail-row">
                <span className="detail-label">Open for Applications:</span>
                <span className="detail-value">{formData.is_open_for_applications ? "Yes" : "No"}</span>
              </div>
            </div>

            {/* Image Section - Right Column */}
            <div className="event-image-section">
              {imagePreview ? (
                <div className="event-image-preview">
                  <img src={imagePreview} alt="Event" />
                  <button
                    type="button"
                    className="btn-remove-image-icon"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    title="Remove image"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="no-image">No image uploaded</div>
              )}
              <div className="image-upload-section">
                <input
                  type="file"
                  id="event-image-upload"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="event-image-upload" className="btn-upload-image">
                  {imagePreview ? "Change Image" : "Upload Image"}
                </label>
              </div>
            </div>
          </div>

          {/* Bands Section */}
          <div className="event-bands-section">
            <div className="event-detail-row">
              <span className="detail-label">Bands ({eventBands.length}):</span>
            </div>
            {loadingBands ? (
              <div className="bands-loading">Loading bands...</div>
            ) : eventBands.length > 0 ? (
              <div className="event-bands-grid">
                {eventBands.map((bandEvent) => {
                  const bandName = bandEvent.band_name || bandEvent.band?.name || `Band ${bandEvent.band_id}`;
                  const bandImagePath = bandEvent.band_image_path || bandEvent.band?.image_path || null;
                  const apiBaseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
                  const imageUrl = bandImagePath ? `${apiBaseUrl}/${bandImagePath}` : null;
                  
                  return (
                    <div 
                      key={bandEvent.band_id || bandEvent.id} 
                      className="event-band-card clickable-band-card"
                      onClick={() => handleBandCardClick(bandEvent.band_id)}
                    >
                      <div className="band-card-image-container">
                        {imageUrl ? (
                          <img src={imageUrl} alt={bandName} className="band-card-image" />
                        ) : (
                          <div className="band-card-placeholder">No Image</div>
                        )}
                        <button
                          type="button"
                          className="btn-remove-band-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBand(bandEvent.band_id);
                          }}
                          disabled={loading}
                          title="Remove band"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                      <div className="band-card-name">{bandName}</div>
                      <button
                        type="button"
                        className="btn-view-stage-plot"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            // Fetch stage plots for this band
                            const plots = await stagePlotService.getBandStagePlots(bandEvent.band_id);
                            if (plots && plots.length > 0) {
                              // Show the first stage plot
                              setViewingStagePlot({
                                bandId: bandEvent.band_id,
                                bandName: bandName,
                                stagePlotId: plots[0].id
                              });
                            } else {
                              alert(`${bandName} doesn't have any stage plots yet.`);
                            }
                          } catch (err) {
                            console.error("Error fetching stage plots:", err);
                            alert("Failed to load stage plot. Please try again.");
                          }
                        }}
                      >
                        View Stage Plot
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-bands">No bands added yet</div>
            )}

            {/* Add Bands Section */}
            <div className="add-bands-section">
              <BandSearchSelect
                selectedBands={selectedBandsToAdd}
                onBandsChange={setSelectedBandsToAdd}
              />
              {selectedBandsToAdd.length > 0 && (
                <button
                  type="button"
                  className="btn-add-bands"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddBands();
                  }}
                  disabled={loading}
                >
                  {loading ? "Adding..." : `Add ${selectedBandsToAdd.length} Band${selectedBandsToAdd.length > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>

          {/* Application Controls */}
          {event.status === "pending" && (
            <div className="application-controls">
              <div className="application-status-row">
                <div className="event-detail-row">
                  <span className="detail-label">Application Status:</span>
                  <span className="detail-value">
                    {formData.is_open_for_applications ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="application-button-container">
                  {!formData.is_open_for_applications ? (
                    <button
                      type="button"
                      className="btn-open-applications"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenApplications();
                      }}
                      disabled={applicationActionLoading}
                    >
                      {applicationActionLoading ? "Opening..." : "Open for Applications"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-close-applications"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseApplications();
                      }}
                      disabled={applicationActionLoading}
                    >
                      {applicationActionLoading ? "Closing..." : "Close Applications"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="event-edit-actions">
          <button
            type="button"
            className="btn-edit"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            Edit Event
          </button>
          <button
            type="button"
            className="btn-cancel"
            onClick={(e) => {
              e.stopPropagation();
              if (onCancel) onCancel();
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Band Info Modal */}
      {(selectedBand !== null || bandModalLoading || bandModalError) && (
        <div className="band-info-modal-overlay" onClick={handleCloseBandModal}>
          <div className="band-info-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="band-info-modal-header">
              <h2>Band Information</h2>
              <button 
                className="band-info-modal-close"
                onClick={handleCloseBandModal}
              >
                ×
              </button>
            </div>
            <div className="band-info-modal-body">
              {bandModalLoading ? (
                <div className="band-info-loading">Loading band information...</div>
              ) : bandModalError ? (
                <div className="band-info-error">{bandModalError}</div>
              ) : selectedBand ? (
                <>
                  <div className="band-info-main">
                    <h3 className="band-info-name">{selectedBand.name}</h3>
                    {selectedBand.description && (
                      <p className="band-info-description">{selectedBand.description}</p>
                    )}
                  </div>

                  {/* Social Media Links */}
                  <div className="band-info-social">
                    <h4 className="band-info-section-title">Connect</h4>
                    <div className="band-info-social-links">
                      {selectedBand.instagram_url && (
                        <a 
                          href={selectedBand.instagram_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="band-social-link-item"
                        >
                          <span className="social-icon">📷</span>
                          <span>Instagram</span>
                        </a>
                      )}
                      {selectedBand.facebook_url && (
                        <a 
                          href={selectedBand.facebook_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="band-social-link-item"
                        >
                          <span className="social-icon">👥</span>
                          <span>Facebook</span>
                        </a>
                      )}
                      {selectedBand.website_url && (
                        <a 
                          href={selectedBand.website_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="band-social-link-item"
                        >
                          <span className="social-icon">🌐</span>
                          <span>Website</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Spotify Section */}
                  {selectedBand.spotify_url && (
                    <div className="band-info-spotify">
                      <h4 className="band-info-section-title">Spotify</h4>
                      {isSpotifyIframe(selectedBand.spotify_url) && getSpotifyEmbed(selectedBand.spotify_url) ? (
                        <div className="spotify-embed-container">
                          <iframe
                            src={getSpotifyEmbed(selectedBand.spotify_url)}
                            width="100%"
                            height="352"
                            frameBorder="0"
                            allowtransparency="true"
                            allow="encrypted-media"
                            title="Spotify Embed"
                            style={{ borderRadius: '12px' }}
                          />
                        </div>
                      ) : (
                        <a 
                          href={selectedBand.spotify_url.startsWith('http') ? selectedBand.spotify_url : `https://${selectedBand.spotify_url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="band-social-link-item spotify-link"
                        >
                          <span className="social-icon">🎵</span>
                          <span>Listen on Spotify</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Additional Info */}
                  <div className="band-info-additional">
                    {selectedBand.genre && (
                      <div className="band-info-item">
                        <span className="band-info-label">Genre:</span>
                        <span className="band-info-value">{selectedBand.genre}</span>
                      </div>
                    )}
                    {selectedBand.location && (
                      <div className="band-info-item">
                        <span className="band-info-label">Location:</span>
                        <span className="band-info-value">{selectedBand.location}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Stage Plot View Modal */}
      {viewingStagePlot && (
        <div className="stage-plot-modal-overlay" onClick={() => setViewingStagePlot(null)}>
          <div className="stage-plot-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="stage-plot-modal-header">
              <h2>{viewingStagePlot.bandName} - {viewingStagePlot.plotName || "Stage Plot"}</h2>
              <button 
                className="stage-plot-modal-close"
                onClick={() => setViewingStagePlot(null)}
              >
                ×
              </button>
            </div>
            <div className="stage-plot-modal-body">
              <StagePlot
                onBack={() => setViewingStagePlot(null)}
                bandId={viewingStagePlot.bandId}
                stagePlotId={viewingStagePlot.stagePlotId}
                viewOnly={true}
                onPlotNameChange={(plotName) => {
                  setViewingStagePlot(prev => ({ ...prev, plotName }));
                }}
              />
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <>
    <div className="event-edit-form-container" onClick={(e) => e.stopPropagation()}>
      {error && <div className="event-form-error">{error}</div>}

      <form onSubmit={handleSubmit} className="event-edit-form">
        <div className="form-group">
          <label htmlFor="name">Event Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            maxLength={255}
            placeholder="Enter event name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            maxLength={2000}
            placeholder="Enter event description"
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {formData.status === "pending" && (
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_open_for_applications"
                checked={formData.is_open_for_applications}
                onChange={handleChange}
              />
              <span>Open for band applications</span>
            </label>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="event_date">Event Date *</label>
            <input
              type="date"
              id="event_date"
              name="event_date"
              value={formData.event_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="show_time">Show Time *</label>
            <input
              type="time"
              id="show_time"
              name="show_time"
              value={formData.show_time}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="doors_time">Doors Time</label>
            <input
              type="time"
              id="doors_time"
              name="doors_time"
              value={formData.doors_time}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="is_ticketed"
              checked={formData.is_ticketed}
              onChange={handleChange}
            />
            <span>This is a ticketed event</span>
          </label>
        </div>

        {formData.is_ticketed && (
          <div className="form-group">
            <label htmlFor="ticket_price">Ticket Price (in dollars) *</label>
            <input
              type="number"
              id="ticket_price"
              name="ticket_price"
              value={formData.ticket_price}
              onChange={handleChange}
              min={0}
              step="0.01"
              required={formData.is_ticketed}
              placeholder="e.g., 15.00"
            />
          </div>
        )}

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="is_age_restricted"
              checked={formData.is_age_restricted}
              onChange={handleChange}
            />
            <span>This event has an age restriction</span>
          </label>
        </div>

        {formData.is_age_restricted && (
          <div className="form-group">
            <label htmlFor="age_restriction">Minimum Age *</label>
            <input
              type="number"
              id="age_restriction"
              name="age_restriction"
              value={formData.age_restriction}
              onChange={handleChange}
              min={0}
              max={100}
              required={formData.is_age_restricted}
              placeholder="e.g., 21"
            />
          </div>
        )}

        {/* Image Section in Edit Form */}
        <div className="form-group">
          <label htmlFor="image">Event Image/Poster</label>
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                type="button"
                className="btn-remove-image-icon"
                onClick={() => {
                  // Check if this is the original image or a new preview
                  const isOriginalImage = event.image_path && !imageFile;
                  if (isOriginalImage) {
                    // If removing original, we need to mark it for removal on submit
                    // Store a flag that we'll check in handleSubmit
                    setImageFile("REMOVE"); // Special marker
                  }
                  setImagePreview(null);
                  // Reset file input
                  const fileInput = document.getElementById('image');
                  if (fileInput) {
                    fileInput.value = '';
                  }
                }}
                disabled={loading}
                title="Remove image"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
          <input
            type="file"
            id="image"
            name="image"
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>

        {/* Bands Section in Edit Form */}
        <div className="form-section bands-section">
          <h3 className="form-section-title">Bands</h3>
          {loadingBands ? (
            <div className="bands-loading">Loading bands...</div>
          ) : eventBands.length > 0 ? (
            <div className="event-bands-grid">
              {eventBands.map((bandEvent) => {
                const bandName = bandEvent.band_name || bandEvent.band?.name || `Band ${bandEvent.band_id}`;
                const bandImagePath = bandEvent.band_image_path || bandEvent.band?.image_path || null;
                const apiBaseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
                const imageUrl = bandImagePath ? `${apiBaseUrl}/${bandImagePath}` : null;
                
                return (
                  <div 
                    key={bandEvent.band_id || bandEvent.id} 
                    className="event-band-card clickable-band-card"
                    onClick={() => handleBandCardClick(bandEvent.band_id)}
                  >
                    <div className="band-card-image-container">
                      {imageUrl ? (
                        <img src={imageUrl} alt={bandName} className="band-card-image" />
                      ) : (
                        <div className="band-card-placeholder">No Image</div>
                      )}
                      <button
                        type="button"
                        className="btn-remove-band-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBand(bandEvent.band_id);
                        }}
                        disabled={loading}
                        title="Remove band"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    <div className="band-card-name">{bandName}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-bands">No bands added yet</div>
          )}

          {/* Add Bands Section */}
          <div className="add-bands-section">
            <BandSearchSelect
              selectedBands={selectedBandsToAdd}
              onBandsChange={setSelectedBandsToAdd}
            />
            {selectedBandsToAdd.length > 0 && (
              <button
                type="button"
                className="btn-add-bands"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddBands();
                }}
                disabled={loading}
              >
                {loading ? "Adding..." : `Add ${selectedBandsToAdd.length} Band${selectedBandsToAdd.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>

        {/* Application Controls in Edit Form */}
        {formData.status === "pending" && (
          <div className="form-section application-controls-section">
            <h3 className="form-section-title">Applications</h3>
            <div className="application-status-row">
              <div className="event-detail-row">
                <span className="detail-label">Application Status:</span>
                <span className="detail-value">
                  {formData.is_open_for_applications ? "Open" : "Closed"}
                </span>
              </div>
              <div className="application-button-container">
                {formData.is_open_for_applications ? (
                  <button
                    type="button"
                    className="btn-close-applications"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseApplications();
                    }}
                    disabled={applicationActionLoading}
                  >
                    {applicationActionLoading ? "Closing..." : "Close Applications"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-open-applications"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenApplications();
                    }}
                    disabled={applicationActionLoading}
                  >
                    {applicationActionLoading ? "Opening..." : "Open for Applications"}
                  </button>
                )}
              </div>
            </div>
            {/* Applications List */}
            {event?.id && (
              <EventApplicationsList 
                eventId={event.id} 
                isOpenForApplications={formData.is_open_for_applications}
                onApplicationReviewed={async () => {
                  // Refresh event bands after application review (accepting adds band to event)
                  await fetchEventBands();
                  // Optionally refresh full event data
                  if (onUpdate) {
                    try {
                      const updatedEvent = await eventService.getEvent(event.id);
                      onUpdate(updatedEvent);
                    } catch (err) {
                      console.error("Error refreshing event:", err);
                    }
                  }
                }}
              />
            )}
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(false);
              setError(null);
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Event"}
          </button>
        </div>
      </form>
    </div>

    {/* Band Info Modal */}
    {(selectedBand !== null || bandModalLoading || bandModalError) && (
      <div className="band-info-modal-overlay" onClick={handleCloseBandModal}>
        <div className="band-info-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="band-info-modal-header">
            <h2>Band Information</h2>
            <button 
              className="band-info-modal-close"
              onClick={handleCloseBandModal}
            >
              ×
            </button>
          </div>
          <div className="band-info-modal-body">
            {bandModalLoading ? (
              <div className="band-info-loading">Loading band information...</div>
            ) : bandModalError ? (
              <div className="band-info-error">{bandModalError}</div>
            ) : selectedBand ? (
              <>
                <div className="band-info-main">
                  <h3 className="band-info-name">{selectedBand.name}</h3>
                  {selectedBand.description && (
                    <p className="band-info-description">{selectedBand.description}</p>
                  )}
                </div>

                {/* Social Media Links */}
                <div className="band-info-social">
                  <h4 className="band-info-section-title">Connect</h4>
                  <div className="band-info-social-links">
                    {selectedBand.instagram_url && (
                      <a 
                        href={selectedBand.instagram_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="band-social-link-item"
                      >
                        <span className="social-icon">📷</span>
                        <span>Instagram</span>
                      </a>
                    )}
                    {selectedBand.facebook_url && (
                      <a 
                        href={selectedBand.facebook_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="band-social-link-item"
                      >
                        <span className="social-icon">👥</span>
                        <span>Facebook</span>
                      </a>
                    )}
                    {selectedBand.website_url && (
                      <a 
                        href={selectedBand.website_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="band-social-link-item"
                      >
                        <span className="social-icon">🌐</span>
                        <span>Website</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Spotify Section */}
                {selectedBand.spotify_url && (
                  <div className="band-info-spotify">
                    <h4 className="band-info-section-title">Spotify</h4>
                    {isSpotifyIframe(selectedBand.spotify_url) ? (
                      <div className="spotify-embed-container">
                        <iframe
                          src={getSpotifyEmbed(selectedBand.spotify_url)}
                          width="100%"
                          height="352"
                          frameBorder="0"
                          allowtransparency="true"
                          allow="encrypted-media"
                          title="Spotify Embed"
                          style={{ borderRadius: '12px' }}
                        />
                      </div>
                    ) : (
                      <a 
                        href={selectedBand.spotify_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="band-social-link-item spotify-link"
                      >
                        <span className="social-icon">🎵</span>
                        <span>Listen on Spotify</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Additional Info */}
                <div className="band-info-additional">
                  {selectedBand.genre && (
                    <div className="band-info-item">
                      <span className="band-info-label">Genre:</span>
                      <span className="band-info-value">{selectedBand.genre}</span>
                    </div>
                  )}
                  {selectedBand.location && (
                    <div className="band-info-item">
                      <span className="band-info-label">Location:</span>
                      <span className="band-info-value">{selectedBand.location}</span>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    )}

    {/* Stage Plot View Modal */}
    {viewingStagePlot && (
      <div className="stage-plot-modal-overlay" onClick={() => setViewingStagePlot(null)}>
        <div className="stage-plot-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="stage-plot-modal-header">
            <h2>{viewingStagePlot.bandName} - {viewingStagePlot.plotName || "Stage Plot"}</h2>
            <button 
              className="stage-plot-modal-close"
              onClick={() => setViewingStagePlot(null)}
            >
              ×
            </button>
          </div>
          <div className="stage-plot-modal-body">
            <StagePlot
              onBack={() => setViewingStagePlot(null)}
              bandId={viewingStagePlot.bandId}
              stagePlotId={viewingStagePlot.stagePlotId}
              viewOnly={true}
              onPlotNameChange={(plotName) => {
                setViewingStagePlot(prev => ({ ...prev, plotName }));
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default EventEditForm;

