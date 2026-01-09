import React, { useState } from "react";
import { eventService } from "../../services/eventService";
import "./EventModal.css";

const GigModal = ({ bandId, onClose, onSuccess, initialDate = null }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_date: initialDate ? initialDate.toISOString().split('T')[0] : "",
    doors_time: "",
    show_time: "",
    location_name: "",
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
    is_ticketed: false,
    ticket_price: "",
    is_age_restricted: false,
    age_restriction: "",
    genre_tags: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear ticket price if not ticketed
    if (name === 'is_ticketed' && !checked) {
      setFormData(prev => ({ ...prev, ticket_price: "" }));
    }

    // Clear age restriction if not age restricted
    if (name === 'is_age_restricted' && !checked) {
      setFormData(prev => ({ ...prev, age_restriction: "" }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("Image size must be less than 5MB");
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

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError("Event name is required");
      return;
    }
    if (!formData.event_date) {
      setError("Event date is required");
      return;
    }
    if (!formData.show_time) {
      setError("Show time is required");
      return;
    }
    if (!formData.location_name.trim()) {
      setError("Location name is required");
      return;
    }
    if (!formData.city.trim()) {
      setError("City is required");
      return;
    }
    if (!formData.state.trim()) {
      setError("State/Province is required");
      return;
    }
    if (formData.is_ticketed && formData.ticket_price && parseFloat(formData.ticket_price) <= 0) {
      setError("Ticket price must be greater than 0");
      return;
    }
    if (formData.is_age_restricted && formData.age_restriction && (parseInt(formData.age_restriction) < 0 || parseInt(formData.age_restriction) > 100)) {
      setError("Age restriction must be between 0 and 100");
      return;
    }

    setLoading(true);

    try {
      // Convert ticket price from dollars to cents
      const ticketPriceInCents = formData.is_ticketed && formData.ticket_price 
        ? Math.round(parseFloat(formData.ticket_price) * 100) 
        : null;

      // Prepare event data
      const eventData = {
        ...formData,
        ticket_price: ticketPriceInCents,
        age_restriction: formData.is_age_restricted && formData.age_restriction 
          ? parseInt(formData.age_restriction) 
          : null,
      };

      // Create the event
      await eventService.createBandEvent(bandId, eventData, imageFile);
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("Error creating gig:", err);
      setError(err.message || "Failed to create gig. Please try again.");
      setLoading(false);
    }
  };

  const formatTimeForInput = (timeString) => {
    if (!timeString) return "";
    // If it's already in HH:MM format, return as is
    if (timeString.match(/^\d{2}:\d{2}$/)) return timeString;
    // Otherwise, try to parse and format
    const [hours, minutes] = timeString.split(':');
    return `${hours.padStart(2, '0')}:${minutes ? minutes.padStart(2, '0') : '00'}`;
  };

  return (
    <div className="event-modal-overlay" onClick={onClose}>
      <div className="event-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="modal-header">
          <div className="modal-header-content">
            <h2 className="modal-title">Schedule a Gig</h2>
            <p className="modal-description-header">
              Create a private event or gig for your band
            </p>
          </div>
        </div>

        {error && (
          <div className="modal-error" style={{ margin: '0 24px 16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="gig-form">
          {/* Basic Information */}
          <div className="modal-section">
            <h3 className="modal-section-title">Event Information</h3>
            
            <div className="form-group">
              <label htmlFor="name" className="form-label required">
                Event Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g., Summer Festival 2024"
                maxLength={255}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-textarea"
                placeholder="Tell us about this event..."
                rows={3}
                maxLength={2000}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="genre_tags" className="form-label">
                Genre Tags
              </label>
              <input
                type="text"
                id="genre_tags"
                name="genre_tags"
                value={formData.genre_tags}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g., rock, indie, alternative (comma-separated)"
                disabled={loading}
              />
              <div className="form-hint">
                Add genre tags to help categorize your event
              </div>
            </div>
          </div>

          {/* Date and Time */}
          <div className="modal-section">
            <h3 className="modal-section-title">Date & Time</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="event_date" className="form-label required">
                  Event Date
                </label>
                <input
                  type="date"
                  id="event_date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="show_time" className="form-label required">
                  Show Time
                </label>
                <input
                  type="time"
                  id="show_time"
                  name="show_time"
                  value={formatTimeForInput(formData.show_time)}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="doors_time" className="form-label">
                  Doors Time
                </label>
                <input
                  type="time"
                  id="doors_time"
                  name="doors_time"
                  value={formatTimeForInput(formData.doors_time)}
                  onChange={handleInputChange}
                  className="form-input"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="modal-section">
            <h3 className="modal-section-title">Location</h3>
            
            <div className="form-group">
              <label htmlFor="location_name" className="form-label required">
                Location Name
              </label>
              <input
                type="text"
                id="location_name"
                name="location_name"
                value={formData.location_name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g., Central Park, John's House, Community Center"
                maxLength={255}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="street_address" className="form-label">
                Street Address
              </label>
              <input
                type="text"
                id="street_address"
                name="street_address"
                value={formData.street_address}
                onChange={handleInputChange}
                className="form-input"
                placeholder="123 Main Street"
                maxLength={255}
                disabled={loading}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city" className="form-label required">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Toronto"
                  maxLength={100}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="state" className="form-label required">
                  State/Province
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="ON"
                  maxLength={50}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="zip_code" className="form-label">
                  Postal Code
                </label>
                <input
                  type="text"
                  id="zip_code"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="M5V 3A8"
                  maxLength={20}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Event Image */}
          <div className="modal-section">
            <h3 className="modal-section-title">Event Image</h3>
            
            <div className="form-group">
              {imagePreview ? (
                <div className="image-preview-container">
                  <img 
                    src={imagePreview} 
                    alt="Event preview" 
                    className="image-preview"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="remove-image-btn"
                    disabled={loading}
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <div className="image-upload-container">
                  <label htmlFor="image" className="image-upload-label">
                    <div className="image-upload-placeholder">
                      <span className="upload-icon">📷</span>
                      <span className="upload-text">Click to upload event image</span>
                      <span className="upload-hint">Maximum file size: 5MB</span>
                    </div>
                  </label>
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="image-upload-input"
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Ticketing */}
          <div className="modal-section">
            <h3 className="modal-section-title">Ticketing</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_ticketed"
                  checked={formData.is_ticketed}
                  onChange={handleInputChange}
                  className="form-checkbox"
                  disabled={loading}
                />
                <span>This is a ticketed event</span>
              </label>
            </div>

            {formData.is_ticketed && (
              <div className="form-group">
                <label htmlFor="ticket_price" className="form-label required">
                  Ticket Price ($)
                </label>
                <input
                  type="number"
                  id="ticket_price"
                  name="ticket_price"
                  value={formData.ticket_price}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="25.00"
                  min="0"
                  step="0.01"
                  required
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {/* Age Restriction */}
          <div className="modal-section">
            <h3 className="modal-section-title">Age Restriction</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_age_restricted"
                  checked={formData.is_age_restricted}
                  onChange={handleInputChange}
                  className="form-checkbox"
                  disabled={loading}
                />
                <span>This event has age restrictions</span>
              </label>
            </div>

            {formData.is_age_restricted && (
              <div className="form-group">
                <label htmlFor="age_restriction" className="form-label required">
                  Minimum Age
                </label>
                <input
                  type="number"
                  id="age_restriction"
                  name="age_restriction"
                  value={formData.age_restriction}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="19"
                  min="0"
                  max="100"
                  required
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="modal-section form-actions">
            <button
              type="button"
              onClick={onClose}
              className="form-button cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="form-button submit-button"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Gig"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GigModal;
