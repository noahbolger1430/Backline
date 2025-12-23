import React, { useState, useEffect } from "react";
import { eventService } from "../../services/eventService";
import BandSearchSelect from "./BandSearchSelect";
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
        ticket_price: event.ticket_price ? (event.ticket_price / 100).toString() : "",
        is_age_restricted: event.is_age_restricted || false,
        age_restriction: event.age_restriction ? event.age_restriction.toString() : "",
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
      const updateData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        event_date: formData.event_date,
        doors_time: formData.doors_time && formData.doors_time.trim() ? formData.doors_time.trim() : null,
        show_time: formData.show_time && formData.show_time.trim() ? formData.show_time.trim() : null,
        status: formData.status,
        is_open_for_applications: formData.status === "pending" ? formData.is_open_for_applications : false,
        is_ticketed: formData.is_ticketed,
        ticket_price: formData.is_ticketed && formData.ticket_price 
          ? Math.round(parseFloat(formData.ticket_price) * 100) // Convert dollars to cents
          : null,
        is_age_restricted: formData.is_age_restricted,
        age_restriction: formData.is_age_restricted && formData.age_restriction 
          ? parseInt(formData.age_restriction, 10) 
          : null,
      };
      
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
    return (
      <div className="event-edit-form-container">
        <div className="event-details-view">
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
            <span className="detail-label">Open for Applications:</span>
            <span className="detail-value">{formData.is_open_for_applications ? "Yes" : "No"}</span>
          </div>

          {/* Image Section */}
          <div className="event-image-section">
            <div className="event-detail-row">
              <span className="detail-label">Event Image:</span>
            </div>
            {imagePreview ? (
              <div className="event-image-preview">
                <img src={imagePreview} alt="Event" />
                <button
                  type="button"
                  className="btn-remove-image"
                  onClick={async (e) => {
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
                  }}
                  disabled={loading}
                >
                  {loading ? "Removing..." : "Remove Image"}
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

          {/* Bands Section */}
          <div className="event-bands-section">
            <div className="event-detail-row">
              <span className="detail-label">Bands ({eventBands.length}):</span>
            </div>
            {loadingBands ? (
              <div className="bands-loading">Loading bands...</div>
            ) : eventBands.length > 0 ? (
              <div className="event-bands-list">
                {eventBands.map((bandEvent) => (
                  <div key={bandEvent.band_id || bandEvent.id} className="event-band-item">
                    <span className="band-name">
                      {bandEvent.band_name || bandEvent.band?.name || `Band ${bandEvent.band_id}`}
                    </span>
                    <button
                      type="button"
                      className="btn-remove-band"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBand(bandEvent.band_id);
                      }}
                      disabled={loading}
                    >
                      Remove
                    </button>
                  </div>
                ))}
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
              <div className="event-detail-row">
                <span className="detail-label">Application Status:</span>
                <span className="detail-value">
                  {formData.is_open_for_applications ? "Open" : "Closed"}
                </span>
              </div>
              <div className="application-buttons">
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
    );
  }

  return (
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
            </div>
          )}
          <input
            type="file"
            id="image"
            name="image"
            accept="image/*"
            onChange={handleImageChange}
          />
          {imagePreview && (
            <button
              type="button"
              className="btn-remove-image"
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
            >
              Remove Image
            </button>
          )}
        </div>

        {/* Bands Section in Edit Form */}
        <div className="form-section bands-section">
          <h3 className="form-section-title">Bands</h3>
          {loadingBands ? (
            <div className="bands-loading">Loading bands...</div>
          ) : eventBands.length > 0 ? (
            <div className="event-bands-list">
              {eventBands.map((bandEvent) => (
                <div key={bandEvent.band_id || bandEvent.id} className="event-band-item">
                  <span className="band-name">
                    {bandEvent.band_name || bandEvent.band?.name || `Band ${bandEvent.band_id}`}
                  </span>
                  <button
                    type="button"
                    className="btn-remove-band"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBand(bandEvent.band_id);
                    }}
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              ))}
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
            <div className="event-detail-row">
              <span className="detail-label">Current Status:</span>
              <span className="detail-value">
                {formData.is_open_for_applications ? "Open" : "Closed"}
              </span>
            </div>
            <div className="application-buttons">
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
  );
};

export default EventEditForm;

