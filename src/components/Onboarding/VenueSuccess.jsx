import React, { useState } from "react";
import "./Onboarding.css";

const VenueSuccess = ({ venue, onContinue, isNewVenue = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(venue.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/join-venue/${venue.invite_code}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card success-card">
        <h1 className="app-title">BackLine</h1>

        <div className="success-icon">✅</div>

        {isNewVenue ? (
          <>
            <h2 className="success-heading">{venue.name} Created Successfully!</h2>
            <p className="success-text">Share this invite code with your staff members:</p>
          </>
        ) : (
          <>
            <h2 className="success-heading">Welcome to {venue.name}!</h2>
            <p className="success-text">You've successfully joined the venue staff.</p>
          </>
        )}

        {isNewVenue && (
          <div className="invite-code-section">
            <div className="invite-code-box">
              <span className="invite-code">{venue.invite_code}</span>
            </div>

            <div className="copy-buttons">
              <button className="copy-button" onClick={handleCopyCode}>
                {copied ? "✓ Copied!" : "Copy Code"}
              </button>

              <button className="copy-button" onClick={handleCopyLink}>
                Copy Invite Link
              </button>
            </div>

            <p className="invite-instruction">Staff members can use this code to join during signup</p>
          </div>
        )}

        <div className="venue-details">
          <h3>Venue Details</h3>
          <div className="detail-item">
            <span className="detail-label">Name:</span>
            <span className="detail-value">{venue.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Address:</span>
            <span className="detail-value">
              {venue.street_address}, {venue.city}, {venue.state} {venue.zip_code}
            </span>
          </div>
          {venue.capacity && (
            <div className="detail-item">
              <span className="detail-label">Capacity:</span>
              <span className="detail-value">{venue.capacity}</span>
            </div>
          )}
          <div className="detail-item">
            <span className="detail-label">Amenities:</span>
            <span className="detail-value">
              {[venue.has_sound_provided && "Sound System", venue.has_parking && "Parking"]
                .filter(Boolean)
                .join(", ") || "None listed"}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Staff Members:</span>
            <span className="detail-value">{venue.staff?.length || 1}</span>
          </div>
        </div>

        <button className="button primary large" onClick={onContinue}>
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
};

export default VenueSuccess;

