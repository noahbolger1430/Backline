import React, { useState } from "react";
import { bandService } from "../../services/bandService";
import "./Onboarding.css";

const BandCreation = ({ onSuccess, onBack }) => {
  const [formData, setFormData] = useState({
    name: "",
    genre: "",
    location: "",
    description: "",
    instrument: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const bandData = {
        name: formData.name,
        genre: formData.genre,
        location: formData.location,
        description: formData.description,
      };

      const band = await bandService.createBand(bandData);

      localStorage.setItem("user_instrument", formData.instrument);

      onSuccess(band);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <h1 className="app-title">BackLine</h1>
        <h2 className="onboarding-heading">Create Your Band</h2>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Band Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your band name"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="genre">Genre</label>
            <input
              type="text"
              id="genre"
              name="genre"
              value={formData.genre}
              onChange={handleChange}
              placeholder="e.g., Rock, Jazz, Pop"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., New York, NY"
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
              placeholder="Tell us about your band..."
              rows="3"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="instrument">What do you play?</label>
            <input
              type="text"
              id="instrument"
              name="instrument"
              value={formData.instrument}
              onChange={handleChange}
              placeholder="e.g., Guitar, Drums, Vocals"
              disabled={isLoading}
            />
          </div>

          <div className="button-group">
            <button type="button" className="button secondary" onClick={onBack} disabled={isLoading}>
              Back
            </button>

            <button type="submit" className="button primary" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Band"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BandCreation;

