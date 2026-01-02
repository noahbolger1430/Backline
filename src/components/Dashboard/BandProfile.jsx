import React, { useState } from "react";
import { bandService } from "../../services/bandService";
import { getImageUrl } from "../../utils/imageUtils";
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
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
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

  const handleLogoChange = (e) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleLogoChange',message:'Logo file picker triggered',data:{hasFile:!!e.target.files[0],fileName:e.target.files[0]?.name,fileSize:e.target.files[0]?.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const file = e.target.files[0];
    if (file) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleLogoChange',message:'Setting selectedLogo state',data:{fileName:file.name,fileSize:file.size,fileType:file.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setSelectedLogo(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleLogoChange',message:'No file selected',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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
    setSelectedLogo(null);
    setLogoPreview(null);
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
      // Only make API call if there are changes or an image/logo was selected
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleSubmit',message:'Before API call check',data:{hasUpdateData:Object.keys(updateData).length>0,hasSelectedImage:!!selectedImage,hasSelectedLogo:!!selectedLogo,selectedLogoName:selectedLogo?.name,selectedLogoSize:selectedLogo?.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (Object.keys(updateData).length > 0 || selectedImage || selectedLogo) {
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleSubmit',message:'Calling updateBand service',data:{bandId:band.id,hasImage:!!selectedImage,hasLogo:!!selectedLogo,logoFileName:selectedLogo?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const updatedBand = await bandService.updateBand(band.id, allFormData, selectedImage, selectedLogo);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleSubmit',message:'API call completed',data:{hasLogoPath:!!updatedBand.logo_path,logoPath:updatedBand.logo_path,bandName:updatedBand.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        if (onBandUpdate) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleSubmit',message:'Calling onBandUpdate callback',data:{hasLogoPath:!!updatedBand.logo_path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
          onBandUpdate(updatedBand);
        }
        // Clear image/logo selection after successful upload
        setSelectedImage(null);
        setImagePreview(null);
        setSelectedLogo(null);
        setLogoPreview(null);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandProfile.jsx:handleSubmit',message:'Skipping API call - no changes',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
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
                    src={imagePreview || getImageUrl(band.image_path, API_BASE_URL)}
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
                  src={getImageUrl(band.image_path, API_BASE_URL)}
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
          <label htmlFor="band-logo">Band Logo</label>
          {isEditing ? (
            <div className="band-profile-image-upload">
              <input
                type="file"
                id="band-logo"
                name="logo"
                accept="image/*"
                onChange={handleLogoChange}
                className="band-profile-file-input"
                disabled={loading}
              />
              {(logoPreview || (band.logo_path && !selectedLogo)) && (
                <div className="band-profile-image-preview">
                  <img
                    src={logoPreview || getImageUrl(band.logo_path, API_BASE_URL)}
                    alt="Band logo preview"
                    className="band-profile-preview-img"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="band-profile-image-display">
              {band.logo_path ? (
                <img
                  src={getImageUrl(band.logo_path, API_BASE_URL)}
                  alt={`${band.name} logo`}
                  className="band-profile-img"
                />
              ) : (
                <div className="band-profile-no-image">No logo uploaded</div>
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
          <label htmlFor="band-instagram">
            <svg className="social-logo" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Instagram
          </label>
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
          <label htmlFor="band-facebook">
            <svg className="social-logo" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </label>
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
          <label htmlFor="band-spotify">
            <svg className="social-logo" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify
          </label>
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

