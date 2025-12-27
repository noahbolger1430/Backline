import React, { useState } from "react";
import { eventService } from "../../services/eventService";
import BandSearchSelect from "./BandSearchSelect";
import "./EventCreateForm.css";

const EventCreateForm = ({ venueId, onEventCreated, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_date: "",
    doors_time: "",
    show_time: "",
    is_pending: false,
    is_open_for_applications: false,
    is_ticketed: false,
    ticket_price: "",
    is_age_restricted: false,
    age_restriction: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedBands, setSelectedBands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Special handling for is_pending checkbox
    if (name === "is_pending" && !checked) {
      // If unchecking pending, also uncheck open for applications
      setFormData((prev) => ({
        ...prev,
        is_pending: false,
        is_open_for_applications: false,
      }));
      return;
    }
    
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
    setLoading(true);
    setError(null);

    try {
      // Clean and format data before sending
      const eventData = {
        venue_id: venueId,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        event_date: formData.event_date,
        doors_time: formData.doors_time && formData.doors_time.trim() ? formData.doors_time.trim() : null,
        show_time: formData.show_time && formData.show_time.trim() ? formData.show_time.trim() : null,
        status: formData.is_pending ? "pending" : "confirmed",
        is_open_for_applications: formData.is_pending ? formData.is_open_for_applications : false,
        is_ticketed: formData.is_ticketed,
        ticket_price: formData.is_ticketed && formData.ticket_price 
          ? Math.round(parseFloat(formData.ticket_price) * 100 + 0.0001) // Add small epsilon to avoid floating point errors
          : null,
        is_age_restricted: formData.is_age_restricted,
        age_restriction: formData.is_age_restricted && formData.age_restriction 
          ? parseInt(formData.age_restriction, 10) 
          : null,
      };
      
      // Validate required fields
      if (!eventData.name || eventData.name.length === 0) {
        setError("Event name is required");
        return;
      }
      if (!eventData.show_time) {
        setError("Show time is required");
        return;
      }

      // Extract band IDs from selected bands
      const bandIds = selectedBands.map((band) => band.id).join(",");
      
      await eventService.createEvent(eventData, imageFile, bandIds || null);
      onEventCreated();
    } catch (err) {
      setError(err.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-create-form-container">
      <div className="event-create-form-header">
        <h2>Create New Event</h2>
      </div>

      {error && <div className="event-form-error">{error}</div>}

      <form onSubmit={handleSubmit} className="event-create-form">
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

        <div className="form-section">
          <h3 className="form-section-title">Event Status</h3>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_pending"
                checked={formData.is_pending}
                onChange={handleChange}
              />
              <span>Create as pending event</span>
            </label>
            <p className="form-help-text">
              Pending events allow you to build the lineup before confirming the event.
            </p>
          </div>

          {formData.is_pending && (
            <div className="form-group checkbox-group nested-checkbox">
              <label>
                <input
                  type="checkbox"
                  name="is_open_for_applications"
                  checked={formData.is_open_for_applications}
                  onChange={handleChange}
                />
                <span>Open for band applications</span>
              </label>
              <p className="form-help-text">
                Allow bands to submit applications to perform at this event.
              </p>
            </div>
          )}
        </div>

        {!formData.is_pending && (
          <div className="form-group">
            <BandSearchSelect
              selectedBands={selectedBands}
              onBandsChange={setSelectedBands}
            />
          </div>
        )}

        {formData.is_pending && !formData.is_open_for_applications && (
          <div className="form-group">
            <BandSearchSelect
              selectedBands={selectedBands}
              onBandsChange={setSelectedBands}
            />
            <p className="form-help-text">
              You can also add bands directly while the event is pending.
            </p>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="image">Event Image/Poster</label>
          <input
            type="file"
            id="image"
            name="image"
            accept="image/*"
            onChange={handleImageChange}
          />
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
            </div>
          )}
        </div>

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
            <label htmlFor="ticket_price">Ticket Price *</label>
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

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
          >
            {loading ? "Creating..." : formData.is_pending ? "Create Pending Event" : "Create Event"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventCreateForm;
