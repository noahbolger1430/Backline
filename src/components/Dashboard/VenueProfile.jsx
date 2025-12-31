import React, { useState, useEffect, useRef } from "react";
import { venueService } from "../../services/venueService";
import VenueEquipment from "./VenueEquipment";
import "./Dashboard.css";

const DAYS_OF_WEEK = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const DEFAULT_HOURS = DAYS_OF_WEEK.map((day) => ({
  day_of_week: day.value,
  is_closed: false,
  open_time: "09:00",
  close_time: "17:00",
}));

const VenueProfile = ({ venueId, onVenueUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [venue, setVenue] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
    capacity: "",
    has_sound_provided: false,
    has_parking: false,
    age_restriction: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Contact section state
  const [contactExpanded, setContactExpanded] = useState(false);
  const [contactEditing, setContactEditing] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState(null);
  const [contactFormData, setContactFormData] = useState({
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });

  // Operating hours state
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [operatingHours, setOperatingHours] = useState([]);
  const [hoursFormData, setHoursFormData] = useState(DEFAULT_HOURS);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursError, setHoursError] = useState(null);
  const [hoursEditing, setHoursEditing] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchVenueData = async () => {
      try {
        setLoading(true);
        const venueData = await venueService.getVenueDetails(venueId);
        setVenue(venueData);
        setFormData({
          name: venueData.name || "",
          description: venueData.description || "",
          street_address: venueData.street_address || "",
          city: venueData.city || "",
          state: venueData.state || "",
          zip_code: venueData.zip_code || "",
          capacity: venueData.capacity || "",
          has_sound_provided: venueData.has_sound_provided || false,
          has_parking: venueData.has_parking || false,
          age_restriction: venueData.age_restriction || "",
        });
        setContactFormData({
          contact_name: venueData.contact_name || "",
          contact_email: venueData.contact_email || "",
          contact_phone: venueData.contact_phone || "",
        });
      } catch (err) {
        setError(err.message || "Failed to load venue information");
        console.error("Error fetching venue data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (venueId) {
      fetchVenueData();
    }
  }, [venueId]);

  // Fetch operating hours when section is expanded
  useEffect(() => {
    const fetchOperatingHours = async () => {
      if (!hoursExpanded || !venueId) return;

      try {
        setHoursLoading(true);
        setHoursError(null);
        const hours = await venueService.getVenueOperatingHours(venueId);
        setOperatingHours(hours);

        // Initialize form data with existing hours or defaults
        if (hours && hours.length > 0) {
          const formattedHours = DAYS_OF_WEEK.map((day) => {
            const existingHour = hours.find((h) => h.day_of_week === day.value);
            if (existingHour) {
              return {
                day_of_week: existingHour.day_of_week,
                is_closed: existingHour.is_closed,
                open_time: existingHour.open_time ? existingHour.open_time.slice(0, 5) : "09:00",
                close_time: existingHour.close_time ? existingHour.close_time.slice(0, 5) : "17:00",
              };
            }
            return {
              day_of_week: day.value,
              is_closed: false,
              open_time: "09:00",
              close_time: "17:00",
            };
          });
          setHoursFormData(formattedHours);
        } else {
          setHoursFormData(DEFAULT_HOURS);
        }
      } catch (err) {
        setHoursError(err.message || "Failed to load operating hours");
        console.error("Error fetching operating hours:", err);
      } finally {
        setHoursLoading(false);
      }
    };

    fetchOperatingHours();
  }, [hoursExpanded, venueId]);

  const handleInputChange = (e) => {
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
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setError("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setError("Image file size must be less than 5MB");
        return;
      }

      setImageFile(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setError(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      name: venue?.name || "",
      description: venue?.description || "",
      street_address: venue?.street_address || "",
      city: venue?.city || "",
      state: venue?.state || "",
      zip_code: venue?.zip_code || "",
      capacity: venue?.capacity || "",
      has_sound_provided: venue?.has_sound_provided || false,
      has_parking: venue?.has_parking || false,
      age_restriction: venue?.age_restriction || "",
    });
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      // Prepare update data - only include fields that have changed
      const updateData = {};
      if (formData.name !== venue.name) {
        updateData.name = formData.name;
      }
      if (formData.description !== (venue.description || "")) {
        updateData.description = formData.description || null;
      }
      if (formData.street_address !== venue.street_address) {
        updateData.street_address = formData.street_address;
      }
      if (formData.city !== venue.city) {
        updateData.city = formData.city;
      }
      if (formData.state !== venue.state) {
        updateData.state = formData.state;
      }
      if (formData.zip_code !== venue.zip_code) {
        updateData.zip_code = formData.zip_code;
      }
      
      const formCapacity = formData.capacity === "" ? null : parseInt(formData.capacity, 10);
      if (formCapacity !== venue.capacity) {
        updateData.capacity = formCapacity;
      }
      
      if (formData.has_sound_provided !== venue.has_sound_provided) {
        updateData.has_sound_provided = formData.has_sound_provided;
      }
      if (formData.has_parking !== venue.has_parking) {
        updateData.has_parking = formData.has_parking;
      }
      
      const formAgeRestriction = formData.age_restriction === "" ? null : parseInt(formData.age_restriction, 10);
      if (formAgeRestriction !== venue.age_restriction) {
        updateData.age_restriction = formAgeRestriction;
      }

      let updatedVenue = venue;

      // Update venue info if there are changes
      if (Object.keys(updateData).length > 0) {
        updatedVenue = await venueService.updateVenue(venueId, updateData);
      }

      // Upload new image if selected
      if (imageFile) {
        updatedVenue = await venueService.updateVenueImage(venueId, imageFile);
      }

      setVenue(updatedVenue);
      if (onVenueUpdate) {
        onVenueUpdate(updatedVenue);
      }

      setIsEditing(false);
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      setError(err.message || "Failed to update venue information");
      console.error("Error updating venue:", err);
    } finally {
      setSaving(false);
    }
  };

  // Contact handlers
  const handleContactToggle = () => {
    setContactExpanded((prev) => !prev);
  };

  const handleContactEditClick = () => {
    setContactEditing(true);
    setContactError(null);
  };

  const handleContactCancel = () => {
    setContactEditing(false);
    setContactError(null);
    setContactFormData({
      contact_name: venue?.contact_name || "",
      contact_email: venue?.contact_email || "",
      contact_phone: venue?.contact_phone || "",
    });
  };

  const handleContactInputChange = (e) => {
    const { name, value } = e.target;
    setContactFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleContactSubmit = async () => {
    try {
      setContactSaving(true);
      setContactError(null);

      // Validate email format if provided
      if (contactFormData.contact_email && contactFormData.contact_email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactFormData.contact_email.trim())) {
          setContactError("Please enter a valid email address");
          setContactSaving(false);
          return;
        }
      }

      // Prepare update data
      const updateData = {};
      const newContactName = contactFormData.contact_name.trim() || null;
      const newContactEmail = contactFormData.contact_email.trim() || null;
      const newContactPhone = contactFormData.contact_phone.trim() || null;

      if (newContactName !== (venue.contact_name || null)) {
        updateData.contact_name = newContactName;
      }
      if (newContactEmail !== (venue.contact_email || null)) {
        updateData.contact_email = newContactEmail;
      }
      if (newContactPhone !== (venue.contact_phone || null)) {
        updateData.contact_phone = newContactPhone;
      }

      if (Object.keys(updateData).length > 0) {
        const updatedVenue = await venueService.updateVenue(venueId, updateData);
        setVenue(updatedVenue);
        setContactFormData({
          contact_name: updatedVenue.contact_name || "",
          contact_email: updatedVenue.contact_email || "",
          contact_phone: updatedVenue.contact_phone || "",
        });
        if (onVenueUpdate) {
          onVenueUpdate(updatedVenue);
        }
      }

      setContactEditing(false);
    } catch (err) {
      setContactError(err.message || "Failed to update contact information");
      console.error("Error updating contact:", err);
    } finally {
      setContactSaving(false);
    }
  };

  // Operating hours handlers
  const handleHoursToggle = () => {
    setHoursExpanded((prev) => !prev);
  };

  const handleHoursEditClick = () => {
    setHoursEditing(true);
    setHoursError(null);
  };

  const handleHoursCancel = () => {
    setHoursEditing(false);
    setHoursError(null);
    // Reset form data to original values
    if (operatingHours && operatingHours.length > 0) {
      const formattedHours = DAYS_OF_WEEK.map((day) => {
        const existingHour = operatingHours.find((h) => h.day_of_week === day.value);
        if (existingHour) {
          return {
            day_of_week: existingHour.day_of_week,
            is_closed: existingHour.is_closed,
            open_time: existingHour.open_time ? existingHour.open_time.slice(0, 5) : "09:00",
            close_time: existingHour.close_time ? existingHour.close_time.slice(0, 5) : "17:00",
          };
        }
        return {
          day_of_week: day.value,
          is_closed: false,
          open_time: "09:00",
          close_time: "17:00",
        };
      });
      setHoursFormData(formattedHours);
    } else {
      setHoursFormData(DEFAULT_HOURS);
    }
  };

  const handleHoursChange = (dayIndex, field, value) => {
    setHoursFormData((prev) => {
      const updated = [...prev];
      updated[dayIndex] = {
        ...updated[dayIndex],
        [field]: field === "is_closed" ? value : value,
      };
      return updated;
    });
  };

  const handleHoursSubmit = async () => {
    try {
      setHoursSaving(true);
      setHoursError(null);

      // Validate hours before submitting
      for (const hour of hoursFormData) {
        if (!hour.is_closed && (!hour.open_time || !hour.close_time)) {
          const dayName = DAYS_OF_WEEK.find((d) => d.value === hour.day_of_week)?.label;
          setHoursError(`Please set open and close times for ${dayName} or mark it as closed`);
          setHoursSaving(false);
          return;
        }
      }

      const updatedHours = await venueService.updateVenueOperatingHours(venueId, hoursFormData);
      setOperatingHours(updatedHours);
      setHoursEditing(false);
    } catch (err) {
      setHoursError(err.message || "Failed to update operating hours");
      console.error("Error updating operating hours:", err);
    } finally {
      setHoursSaving(false);
    }
  };

  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return "Not set";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatPhoneDisplay = (phone) => {
    if (!phone) return "Not set";
    // Simple formatting for US phone numbers
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getImageUrl = () => {
    if (imagePreview) {
      return imagePreview;
    }
    if (venue?.image_path) {
      // Handle both relative and absolute paths
      if (venue.image_path.startsWith("http")) {
        return venue.image_path;
      }
      // Remove /api/v1 from the base URL for image paths
      const baseUrl = API_BASE_URL.replace("/api/v1", "");
      return `${baseUrl}/${venue.image_path}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="user-profile-container">
        <div className="loading-message">Loading venue profile...</div>
      </div>
    );
  }

  if (error && !venue) {
    return (
      <div className="user-profile-container">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="user-profile-container">
        <div className="error-message">Venue information not available</div>
      </div>
    );
  }

  const currentImageUrl = getImageUrl();

  return (
    <div className="user-profile-container">
      {error && <div className="user-profile-error">{error}</div>}

      <div className="user-profile-content">
        {/* Venue Image Section */}
        <div className="user-profile-field">
          <label>Venue Image</label>
          <div className="venue-profile-image-section">
            {currentImageUrl ? (
              <div 
                className={`venue-profile-image-container ${isEditing ? "editable" : ""}`}
                onClick={handleImageClick}
              >
                <img 
                  src={currentImageUrl} 
                  alt={venue.name} 
                  className="venue-profile-image"
                />
                {isEditing && (
                  <div className="venue-profile-image-overlay">
                    <span>Click to change</span>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className={`venue-profile-image-placeholder ${isEditing ? "editable" : ""}`}
                onClick={handleImageClick}
              >
                {isEditing ? (
                  <span>Click to add image</span>
                ) : (
                  <span>No image</span>
                )}
              </div>
            )}
            {isEditing && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: "none" }}
                  disabled={saving}
                />
                {(imagePreview || imageFile) && (
                  <button
                    type="button"
                    className="venue-profile-remove-image-button"
                    onClick={handleRemoveImage}
                    disabled={saving}
                  >
                    Remove new image
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-name">Venue Name</label>
          {isEditing ? (
            <input
              type="text"
              id="venue-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
            />
          ) : (
            <div className="user-profile-value">{venue.name || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-description">Description</label>
          {isEditing ? (
            <textarea
              id="venue-description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="Enter venue description"
              rows={3}
            />
          ) : (
            <div className="user-profile-value">{venue.description || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-street-address">Street Address</label>
          {isEditing ? (
            <input
              type="text"
              id="venue-street-address"
              name="street_address"
              value={formData.street_address}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="Enter street address"
            />
          ) : (
            <div className="user-profile-value">{venue.street_address || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-city">City</label>
          {isEditing ? (
            <input
              type="text"
              id="venue-city"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="Enter city"
            />
          ) : (
            <div className="user-profile-value">{venue.city || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-state">State</label>
          {isEditing ? (
            <input
              type="text"
              id="venue-state"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="e.g., CA"
              maxLength={2}
            />
          ) : (
            <div className="user-profile-value">{venue.state || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-zip-code">Zip Code</label>
          {isEditing ? (
            <input
              type="text"
              id="venue-zip-code"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="Enter zip code"
              maxLength={6}
            />
          ) : (
            <div className="user-profile-value">{venue.zip_code || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-capacity">Capacity</label>
          {isEditing ? (
            <input
              type="number"
              id="venue-capacity"
              name="capacity"
              value={formData.capacity}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="Enter venue capacity"
              min={1}
            />
          ) : (
            <div className="user-profile-value">{venue.capacity || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="venue-age-restriction">Age Restriction</label>
          {isEditing ? (
            <input
              type="number"
              id="venue-age-restriction"
              name="age_restriction"
              value={formData.age_restriction}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="e.g., 21"
              min={0}
              max={21}
            />
          ) : (
            <div className="user-profile-value">
              {venue.age_restriction ? `${venue.age_restriction}+` : "All ages"}
            </div>
          )}
        </div>

        <div className="user-profile-field">
          <label>Amenities</label>
          {isEditing ? (
            <div className="user-profile-checkbox-group">
              <label className="user-profile-checkbox-label">
                <input
                  type="checkbox"
                  name="has_sound_provided"
                  checked={formData.has_sound_provided}
                  onChange={handleInputChange}
                  disabled={saving}
                />
                Sound Provided
              </label>
              <label className="user-profile-checkbox-label">
                <input
                  type="checkbox"
                  name="has_parking"
                  checked={formData.has_parking}
                  onChange={handleInputChange}
                  disabled={saving}
                />
                Parking Available
              </label>
            </div>
          ) : (
            <div className="user-profile-value">
              {[
                venue.has_sound_provided && "Sound Provided",
                venue.has_parking && "Parking Available",
              ]
                .filter(Boolean)
                .join(", ") || "None"}
            </div>
          )}
        </div>

        <div className="user-profile-field">
          <label>Invite Code</label>
          <div className="user-profile-value">{venue.invite_code || "Not available"}</div>
          <div className="user-profile-hint">
            Share this code with staff members to let them join your venue
          </div>
        </div>

        {/* Collapsible Contact Section */}
        <div className="venue-hours-section">
          <button
            type="button"
            className="venue-hours-toggle"
            onClick={handleContactToggle}
            aria-expanded={contactExpanded}
          >
            <span className="venue-hours-toggle-icon">
              {contactExpanded ? "▼" : "▶"}
            </span>
            <span className="venue-hours-toggle-text">Contact Information</span>
          </button>

          {contactExpanded && (
            <div className="venue-hours-content">
              {contactError && (
                <div className="venue-hours-error">{contactError}</div>
              )}

              <div className="venue-contact-list">
                <div className="venue-contact-field">
                  <label htmlFor="contact-name">Contact Name</label>
                  {contactEditing ? (
                    <input
                      type="text"
                      id="contact-name"
                      name="contact_name"
                      value={contactFormData.contact_name}
                      onChange={handleContactInputChange}
                      className="user-profile-input"
                      disabled={contactSaving}
                      placeholder="Enter contact name"
                    />
                  ) : (
                    <div className="user-profile-value">
                      {venue.contact_name || "Not set"}
                    </div>
                  )}
                </div>

                <div className="venue-contact-field">
                  <label htmlFor="contact-email">Contact Email</label>
                  {contactEditing ? (
                    <input
                      type="email"
                      id="contact-email"
                      name="contact_email"
                      value={contactFormData.contact_email}
                      onChange={handleContactInputChange}
                      className="user-profile-input"
                      disabled={contactSaving}
                      placeholder="Enter contact email"
                    />
                  ) : (
                    <div className="user-profile-value">
                      {venue.contact_email || "Not set"}
                    </div>
                  )}
                </div>

                <div className="venue-contact-field">
                  <label htmlFor="contact-phone">Contact Phone</label>
                  {contactEditing ? (
                    <input
                      type="tel"
                      id="contact-phone"
                      name="contact_phone"
                      value={contactFormData.contact_phone}
                      onChange={handleContactInputChange}
                      className="user-profile-input"
                      disabled={contactSaving}
                      placeholder="Enter contact phone"
                    />
                  ) : (
                    <div className="user-profile-value">
                      {formatPhoneDisplay(venue.contact_phone)}
                    </div>
                  )}
                </div>
              </div>

              <div className="venue-hours-actions">
                {contactEditing ? (
                  <>
                    <button
                      type="button"
                      className="user-profile-button cancel-button"
                      onClick={handleContactCancel}
                      disabled={contactSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="user-profile-button submit-button"
                      onClick={handleContactSubmit}
                      disabled={contactSaving}
                    >
                      {contactSaving ? "Saving..." : "Save Contact"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="user-profile-button edit-button"
                    onClick={handleContactEditClick}
                  >
                    Edit Contact
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Operating Hours Section */}
        <div className="venue-hours-section">
          <button
            type="button"
            className="venue-hours-toggle"
            onClick={handleHoursToggle}
            aria-expanded={hoursExpanded}
          >
            <span className="venue-hours-toggle-icon">
              {hoursExpanded ? "▼" : "▶"}
            </span>
            <span className="venue-hours-toggle-text">Operating Hours</span>
          </button>

          {hoursExpanded && (
            <div className="venue-hours-content">
              {hoursLoading ? (
                <div className="venue-hours-loading">Loading operating hours...</div>
              ) : (
                <>
                  {hoursError && (
                    <div className="venue-hours-error">{hoursError}</div>
                  )}

                  <div className="venue-hours-list">
                    {DAYS_OF_WEEK.map((day, index) => {
                      const hourData = hoursFormData[index];
                      const savedHour = operatingHours.find(
                        (h) => h.day_of_week === day.value
                      );

                      return (
                        <div key={day.value} className="venue-hours-day">
                          <div className="venue-hours-day-label">{day.label}</div>
                          {hoursEditing ? (
                            <div className="venue-hours-day-inputs">
                              <label className="venue-hours-closed-label">
                                <input
                                  type="checkbox"
                                  checked={hourData?.is_closed || false}
                                  onChange={(e) =>
                                    handleHoursChange(index, "is_closed", e.target.checked)
                                  }
                                  disabled={hoursSaving}
                                />
                                Closed
                              </label>
                              {!hourData?.is_closed && (
                                <>
                                  <input
                                    type="time"
                                    value={hourData?.open_time || "09:00"}
                                    onChange={(e) =>
                                      handleHoursChange(index, "open_time", e.target.value)
                                    }
                                    className="venue-hours-time-input"
                                    disabled={hoursSaving}
                                  />
                                  <span className="venue-hours-separator">to</span>
                                  <input
                                    type="time"
                                    value={hourData?.close_time || "17:00"}
                                    onChange={(e) =>
                                      handleHoursChange(index, "close_time", e.target.value)
                                    }
                                    className="venue-hours-time-input"
                                    disabled={hoursSaving}
                                  />
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="venue-hours-day-display">
                              {savedHour ? (
                                savedHour.is_closed ? (
                                  <span className="venue-hours-closed">Closed</span>
                                ) : (
                                  <span>
                                    {formatTimeDisplay(savedHour.open_time)} -{" "}
                                    {formatTimeDisplay(savedHour.close_time)}
                                  </span>
                                )
                              ) : (
                                <span className="venue-hours-not-set">Not set</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="venue-hours-actions">
                    {hoursEditing ? (
                      <>
                        <button
                          type="button"
                          className="user-profile-button cancel-button"
                          onClick={handleHoursCancel}
                          disabled={hoursSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="user-profile-button submit-button"
                          onClick={handleHoursSubmit}
                          disabled={hoursSaving}
                        >
                          {hoursSaving ? "Saving..." : "Save Hours"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="user-profile-button edit-button"
                        onClick={handleHoursEditClick}
                      >
                        Edit Hours
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Venue Equipment Section */}
        <div className="venue-equipment-section-wrapper">
          <VenueEquipment venueId={venueId} />
        </div>
      </div>

      <div className="user-profile-actions">
        {isEditing ? (
          <>
            <button
              className="user-profile-button cancel-button"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="user-profile-button submit-button"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Submitting..." : "Submit"}
            </button>
          </>
        ) : (
          <button
            className="user-profile-button edit-button"
            onClick={handleEditClick}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default VenueProfile;

