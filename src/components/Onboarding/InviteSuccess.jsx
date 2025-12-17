import React, { useState } from "react";
import "./Onboarding.css";

const InviteSuccess = ({ band, onContinue, isNewBand = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(band.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/join/${band.invite_code}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card success-card">
        <h1 className="app-title">BackLine</h1>

        <div className="success-icon">✅</div>

        {isNewBand ? (
          <>
            <h2 className="success-heading">{band.name} Created Successfully!</h2>
            <p className="success-text">Share this invite code with your band members:</p>
          </>
        ) : (
          <>
            <h2 className="success-heading">Welcome to {band.name}!</h2>
            <p className="success-text">You've successfully joined the band.</p>
          </>
        )}

        {isNewBand && (
          <div className="invite-code-section">
            <div className="invite-code-box">
              <span className="invite-code">{band.invite_code}</span>
            </div>

            <div className="copy-buttons">
              <button className="copy-button" onClick={handleCopyCode}>
                {copied ? "✓ Copied!" : "Copy Code"}
              </button>

              <button className="copy-button" onClick={handleCopyLink}>
                Copy Invite Link
              </button>
            </div>

            <p className="invite-instruction">Band members can use this code to join during signup</p>
          </div>
        )}

        <div className="band-details">
          <h3>Band Details</h3>
          <div className="detail-item">
            <span className="detail-label">Name:</span>
            <span className="detail-value">{band.name}</span>
          </div>
          {band.genre && (
            <div className="detail-item">
              <span className="detail-label">Genre:</span>
              <span className="detail-value">{band.genre}</span>
            </div>
          )}
          {band.location && (
            <div className="detail-item">
              <span className="detail-label">Location:</span>
              <span className="detail-value">{band.location}</span>
            </div>
          )}
          <div className="detail-item">
            <span className="detail-label">Members:</span>
            <span className="detail-value">{band.members.length}</span>
          </div>
        </div>

        <button className="button primary large" onClick={onContinue}>
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
};

export default InviteSuccess;

