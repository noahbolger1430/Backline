import React, { useState } from "react";
import { eventService } from "../../services/eventService";
import BandSearchSelect from "./BandSearchSelect";
import "./EventCreateForm.css";

const EventCreateForm = ({ venueId, onEventCreated, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    genre_tags: "",
    event_date: "",
    doors_time: "",
    show_time: "",
    is_pending: false,
    is_open_for_applications: false,
    is_ticketed: false,
    ticket_price: "",
    is_age_restricted: false,
    age_restriction: "",
    is_recurring: false,
    recurring_day_of_week: "",
    recurring_frequency: "",
    recurring_start_date: "",
    recurring_end_date: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedBands, setSelectedBands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to get day name from weekday number
  const getDayName = (weekday) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return days[parseInt(weekday, 10)] || "";
  };

  // Helper function to get weekday from a date string
  // Parses YYYY-MM-DD format and returns weekday (0=Monday, 6=Sunday)
  const getWeekdayFromDate = (dateString) => {
    if (!dateString) return null;
    // Parse the date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date in local timezone (month is 0-indexed in JS Date)
    const date = new Date(year, month - 1, day);
    // getDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convert to our system: 0=Monday, 1=Tuesday, ..., 6=Sunday
    const jsDay = date.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  };

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
    
    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      // Validate recurring dates when day of week or dates change
      if (newData.is_recurring) {
        if (name === "recurring_day_of_week" || name === "recurring_start_date" || name === "recurring_end_date") {
          // Clear error when user is changing the fields
          if (error && error.includes("day of week")) {
            // Error will be re-validated on submit
          }
        }
      }

      return newData;
    });
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
        genre_tags: formData.genre_tags?.trim() || null,
        event_date: formData.is_recurring ? formData.recurring_start_date : formData.event_date,
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
        is_recurring: formData.is_recurring,
        recurring_day_of_week: formData.is_recurring && formData.recurring_day_of_week 
          ? parseInt(formData.recurring_day_of_week, 10) 
          : null,
        recurring_frequency: formData.is_recurring && formData.recurring_frequency 
          ? formData.recurring_frequency 
          : null,
        recurring_start_date: formData.is_recurring && formData.recurring_start_date 
          ? formData.recurring_start_date 
          : null,
        recurring_end_date: formData.is_recurring && formData.recurring_end_date 
          ? formData.recurring_end_date 
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
      
      // Validate recurring event fields
      if (formData.is_recurring) {
        if (!formData.recurring_day_of_week) {
          setError("Day of week is required for recurring events");
          setLoading(false);
          return;
        }
        if (!formData.recurring_frequency) {
          setError("Frequency is required for recurring events");
          setLoading(false);
          return;
        }
        if (!formData.recurring_start_date) {
          setError("Start date is required for recurring events");
          setLoading(false);
          return;
        }
        if (!formData.recurring_end_date) {
          setError("End date is required for recurring events");
          setLoading(false);
          return;
        }
        if (new Date(formData.recurring_end_date) < new Date(formData.recurring_start_date)) {
          setError("End date must be after start date");
          setLoading(false);
          return;
        }

        // Validate that start date matches the selected day of week
        const startDateWeekday = getWeekdayFromDate(formData.recurring_start_date);
        const selectedWeekday = parseInt(formData.recurring_day_of_week, 10);
        if (startDateWeekday !== selectedWeekday) {
          const dayName = getDayName(formData.recurring_day_of_week);
          setError(`Start date must be a ${dayName}. Please select a ${dayName} as the start date.`);
          setLoading(false);
          return;
        }

        // Validate that end date matches the selected day of week
        const endDateWeekday = getWeekdayFromDate(formData.recurring_end_date);
        if (endDateWeekday !== selectedWeekday) {
          const dayName = getDayName(formData.recurring_day_of_week);
          setError(`End date must be a ${dayName}. Please select a ${dayName} as the end date.`);
          setLoading(false);
          return;
        }
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

          {formData.is_open_for_applications && (
            <div className="form-group genre-tags-group">
              <label htmlFor="genre_tags">Looking for genres</label>
              <input
                type="text"
                id="genre_tags"
                name="genre_tags"
                value={formData.genre_tags}
                onChange={handleChange}
                placeholder="e.g., rock, alternative, indie"
                maxLength={500}
              />
              <p className="form-help-text">
                Specify the genres you're looking for (comma-separated). This helps match your event with the right bands in recommendations.
              </p>
            </div>
          )}
        </div>

        {!formData.is_pending && (
          <div className="form-group">
            <BandSearchSelect
              selectedBands={selectedBands}
              onBandsChange={setSelectedBands}
              venueId={venueId}
            />
          </div>
        )}

        {formData.is_pending && !formData.is_open_for_applications && (
          <div className="form-group">
            <BandSearchSelect
              selectedBands={selectedBands}
              onBandsChange={setSelectedBands}
              venueId={venueId}
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
              required={!formData.is_recurring}
              disabled={formData.is_recurring}
            />
            {formData.is_recurring && (
              <p className="form-help-text">
                For recurring events, use the Start Date field below.
              </p>
            )}
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

        <div className="form-section">
          <h3 className="form-section-title">Recurring Event</h3>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_recurring"
                checked={formData.is_recurring}
                onChange={handleChange}
              />
              <span>This is a recurring event</span>
            </label>
            <p className="form-help-text">
              Create an event that repeats on a schedule (e.g., every second Friday).
            </p>
          </div>

          {formData.is_recurring && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="recurring_day_of_week">Day of Week *</label>
                  <select
                    id="recurring_day_of_week"
                    name="recurring_day_of_week"
                    value={formData.recurring_day_of_week}
                    onChange={handleChange}
                    required={formData.is_recurring}
                  >
                    <option value="">Select day</option>
                    <option value="0">Monday</option>
                    <option value="1">Tuesday</option>
                    <option value="2">Wednesday</option>
                    <option value="3">Thursday</option>
                    <option value="4">Friday</option>
                    <option value="5">Saturday</option>
                    <option value="6">Sunday</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="recurring_frequency">Frequency *</label>
                  <select
                    id="recurring_frequency"
                    name="recurring_frequency"
                    value={formData.recurring_frequency}
                    onChange={handleChange}
                    required={formData.is_recurring}
                  >
                    <option value="">Select frequency</option>
                    <option value="weekly">Weekly</option>
                    <option value="bi_weekly">Bi-Weekly (Every 2 weeks)</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="recurring_start_date">
                    Start Date * 
                    {formData.recurring_day_of_week && (
                      <span className="form-help-text-inline">
                        (Must be a {getDayName(formData.recurring_day_of_week)})
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    id="recurring_start_date"
                    name="recurring_start_date"
                    value={formData.recurring_start_date}
                    onChange={handleChange}
                    required={formData.is_recurring}
                  />
                  {formData.recurring_start_date && formData.recurring_day_of_week && 
                   getWeekdayFromDate(formData.recurring_start_date) !== parseInt(formData.recurring_day_of_week, 10) && (
                    <p className="form-error-text">
                      Start date must be a {getDayName(formData.recurring_day_of_week)}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="recurring_end_date">
                    End Date * 
                    {formData.recurring_day_of_week && (
                      <span className="form-help-text-inline">
                        (Must be a {getDayName(formData.recurring_day_of_week)})
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    id="recurring_end_date"
                    name="recurring_end_date"
                    value={formData.recurring_end_date}
                    onChange={handleChange}
                    required={formData.is_recurring}
                    min={formData.recurring_start_date || undefined}
                  />
                  {formData.recurring_end_date && formData.recurring_day_of_week && 
                   getWeekdayFromDate(formData.recurring_end_date) !== parseInt(formData.recurring_day_of_week, 10) && (
                    <p className="form-error-text">
                      End date must be a {getDayName(formData.recurring_day_of_week)}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

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
