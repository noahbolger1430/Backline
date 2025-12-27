import React, { useState } from "react";
import { bandService } from "../../services/bandService";
import "./Dashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const BandProfile = ({ band, onBandUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: band?.name || "",
    description: band?.description || "",
    genre: band?.genre || "",
    location: band?.location || "",
    instagram_url: band?.instagram_url || "",
    facebook_url: band?.facebook_url || "",
    spotify_url: band?.spotify_url || "",
    website_url: band?.website_url || "",
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      name: band?.name || "",
      description: band?.description || "",
      genre: band?.genre || "",
      location: band?.location || "",
      instagram_url: band?.instagram_url || "",
      facebook_url: band?.facebook_url || "",
      spotify_url: band?.spotify_url || "",
      website_url: band?.website_url || "",
    });
    setSelectedImage(null);
    setImagePreview(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare update data - only include fields that have changed
      const updateData = {};
      if (formData.name !== band.name) updateData.name = formData.name;
      if (formData.description !== (band.description || "")) {
        updateData.description = formData.description || null;
      }
      if (formData.genre !== (band.genre || "")) {
        updateData.genre = formData.genre || null;
      }
      if (formData.location !== (band.location || "")) {
        updateData.location = formData.location || null;
      }
      if (formData.instagram_url !== (band.instagram_url || "")) {
        updateData.instagram_url = formData.instagram_url || null;
      }
      if (formData.facebook_url !== (band.facebook_url || "")) {
        updateData.facebook_url = formData.facebook_url || null;
      }
      if (formData.spotify_url !== (band.spotify_url || "")) {
        updateData.spotify_url = formData.spotify_url || null;
      }
      if (formData.website_url !== (band.website_url || "")) {
        updateData.website_url = formData.website_url || null;
      }

      // Always send all current form data when submitting (FormData requires all fields)
      // Only make API call if there are changes or an image was selected
      if (Object.keys(updateData).length > 0 || selectedImage) {
        // Send all form fields, not just changed ones, since we're using FormData
        const allFormData = {
          name: formData.name,
          description: formData.description,
          genre: formData.genre,
          location: formData.location,
          instagram_url: formData.instagram_url,
          facebook_url: formData.facebook_url,
          spotify_url: formData.spotify_url,
          website_url: formData.website_url,
        };
        const updatedBand = await bandService.updateBand(band.id, allFormData, selectedImage);
        if (onBandUpdate) {
          onBandUpdate(updatedBand);
        }
        // Clear image selection after successful upload
        setSelectedImage(null);
        setImagePreview(null);
      }

      setIsEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update band information");
      console.error("Error updating band:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!band) {
    return (
      <div className="band-profile-container">
        <div className="error-message">Band information not available</div>
      </div>
    );
  }

  return (
    <div className="band-profile-container">
      <div className="band-profile-header">
        <h2>Band Profile</h2>
      </div>

      {error && <div className="band-profile-error">{error}</div>}

      <div className="band-profile-content">
        <div className="band-profile-field">
          <label htmlFor="band-image">Profile Photo</label>
          {isEditing ? (
            <div className="band-profile-image-upload">
              <input
                type="file"
                id="band-image"
                name="image"
                accept="image/*"
                onChange={handleImageChange}
                className="band-profile-file-input"
                disabled={loading}
              />
              {(imagePreview || (band.image_path && !selectedImage)) && (
                <div className="band-profile-image-preview">
                  <img
                    src={imagePreview || `${API_BASE_URL}/${band.image_path}`}
                    alt="Band profile preview"
                    className="band-profile-preview-img"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="band-profile-image-display">
              {band.image_path ? (
                <img
                  src={`${API_BASE_URL}/${band.image_path}`}
                  alt={`${band.name} profile`}
                  className="band-profile-img"
                />
              ) : (
                <div className="band-profile-no-image">No profile photo</div>
              )}
            </div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-name">Band Name</label>
          {isEditing ? (
            <input
              type="text"
              id="band-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="band-profile-input"
              disabled={loading}
            />
          ) : (
            <div className="band-profile-value">{band.name || "Not set"}</div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-description">Description</label>
          {isEditing ? (
            <textarea
              id="band-description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="band-profile-textarea"
              rows="4"
              disabled={loading}
              placeholder="Tell us about your band..."
            />
          ) : (
            <div className="band-profile-value">
              {band.description || "No description provided"}
            </div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-genre">Genre</label>
          {isEditing ? (
            <input
              type="text"
              id="band-genre"
              name="genre"
              value={formData.genre}
              onChange={handleInputChange}
              className="band-profile-input"
              disabled={loading}
              placeholder="e.g., Rock, Jazz, Pop"
            />
          ) : (
            <div className="band-profile-value">{band.genre || "Not set"}</div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-location">Location</label>
          {isEditing ? (
            <input
              type="text"
              id="band-location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="band-profile-input"
              disabled={loading}
              placeholder="e.g., New York, NY"
            />
          ) : (
            <div className="band-profile-value">{band.location || "Not set"}</div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-instagram">Instagram</label>
          {isEditing ? (
            <input
              type="url"
              id="band-instagram"
              name="instagram_url"
              value={formData.instagram_url}
              onChange={handleInputChange}
              className="band-profile-input"
              disabled={loading}
              placeholder="https://instagram.com/yourband"
            />
          ) : (
            <div className="band-profile-value">
              {band.instagram_url ? (
                <a href={band.instagram_url} target="_blank" rel="noopener noreferrer" className="band-social-link">
                  <span className="social-icon">📷</span>
                  {band.instagram_url}
                </a>
              ) : (
                "Not set"
              )}
            </div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-facebook">Facebook</label>
          {isEditing ? (
            <input
              type="url"
              id="band-facebook"
              name="facebook_url"
              value={formData.facebook_url}
              onChange={handleInputChange}
              className="band-profile-input"
              disabled={loading}
              placeholder="https://facebook.com/yourband"
            />
          ) : (
            <div className="band-profile-value">
              {band.facebook_url ? (
                <a href={band.facebook_url} target="_blank" rel="noopener noreferrer" className="band-social-link">
                  <span className="social-icon">👥</span>
                  {band.facebook_url}
                </a>
              ) : (
                "Not set"
              )}
            </div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-spotify">Spotify</label>
          {isEditing ? (
            <input
              type="url"
              id="band-spotify"
              name="spotify_url"
              value={formData.spotify_url}
              onChange={handleInputChange}
              className="band-profile-input"
              disabled={loading}
              placeholder="https://open.spotify.com/artist/..."
            />
          ) : (
            <div className="band-profile-value">
              {band.spotify_url ? (
                <a href={band.spotify_url} target="_blank" rel="noopener noreferrer" className="band-social-link">
                  <span className="social-icon">🎵</span>
                  {band.spotify_url}
                </a>
              ) : (
                "Not set"
              )}
            </div>
          )}
        </div>

        <div className="band-profile-field">
          <label htmlFor="band-website">Website</label>
          {isEditing ? (
            <input
              type="url"
              id="band-website"
              name="website_url"
              value={formData.website_url}
              onChange={handleInputChange}
              className="band-profile-input"
              disabled={loading}
              placeholder="https://yourband.com"
            />
          ) : (
            <div className="band-profile-value">
              {band.website_url ? (
                <a href={band.website_url} target="_blank" rel="noopener noreferrer" className="band-social-link">
                  <span className="social-icon">🌐</span>
                  {band.website_url}
                </a>
              ) : (
                "Not set"
              )}
            </div>
          )}
        </div>

        <div className="band-profile-field">
          <label>Invite Code</label>
          <div className="band-profile-value invite-code">{band.invite_code}</div>
          <div className="band-profile-hint">Share this code to invite members to your band</div>
        </div>
      </div>

      <div className="band-profile-actions">
        {isEditing ? (
          <>
            <button
              className="band-profile-button cancel-button"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="band-profile-button submit-button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </>
        ) : (
          <button
            className="band-profile-button edit-button"
            onClick={handleEditClick}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default BandProfile;

