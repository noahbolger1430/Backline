import React, { useState } from "react";
import { venueService } from "../../services/venueService";
import "./Onboarding.css";

const VenueCreation = ({ onSuccess, onBack }) => {
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
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const venueData = {
        name: formData.name,
        description: formData.description || null,
        street_address: formData.street_address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
        has_sound_provided: formData.has_sound_provided,
        has_parking: formData.has_parking,
        age_restriction: formData.age_restriction ? parseInt(formData.age_restriction, 10) : null,
      };

      const venue = await venueService.createVenue(venueData);
      onSuccess(venue);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card venue-creation">
        <h1 className="app-title">BackLine</h1>
        <h2 className="onboarding-heading">Create Your Venue</h2>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h3>Basic Information</h3>

            <div className="form-group">
              <label htmlFor="name">Venue Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter venue name"
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about your venue..."
                rows="3"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Location</h3>

            <div className="form-group">
              <label htmlFor="street_address">Street Address *</label>
              <input
                type="text"
                id="street_address"
                name="street_address"
                value={formData.street_address}
                onChange={handleChange}
                placeholder="123 Main Street"
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">City *</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="state">State *</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="State"
                  maxLength="2"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="zip_code">ZIP Code *</label>
                <input
                  type="text"
                  id="zip_code"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleChange}
                  placeholder="12345"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Venue Details</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="capacity">Capacity</label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  placeholder="Max attendees"
                  min="1"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="age_restriction">Age Restriction</label>
                <select
                  id="age_restriction"
                  name="age_restriction"
                  value={formData.age_restriction}
                  onChange={handleChange}
                  disabled={isLoading}
                >
                  <option value="">All Ages</option>
                  <option value="18">18+</option>
                  <option value="21">21+</option>
                </select>
              </div>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="has_sound_provided"
                  checked={formData.has_sound_provided}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                <span>Sound System Provided</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="has_parking"
                  checked={formData.has_parking}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                <span>Parking Available</span>
              </label>
            </div>
          </div>

          <div className="button-group">
            <button type="button" className="button secondary" onClick={onBack} disabled={isLoading}>
              Back
            </button>

            <button type="submit" className="button primary" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Venue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VenueCreation;

