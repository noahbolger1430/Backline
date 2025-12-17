import React, { useState } from "react";
import { venueService } from "../../services/venueService";
import "./Onboarding.css";

const VenueInviteEntry = ({ onSuccess, onBack }) => {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const venue = await venueService.joinVenueWithInvite(inviteCode);
      onSuccess(venue);
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
        <h2 className="onboarding-heading">Join Your Venue</h2>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="inviteCode">Venue Invite Code</label>
            <input
              type="text"
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter your venue invite code"
              required
              disabled={isLoading}
            />
          </div>

          <div className="button-group">
            <button type="button" className="button secondary" onClick={onBack} disabled={isLoading}>
              Back
            </button>

            <button type="submit" className="button primary" disabled={isLoading}>
              {isLoading ? "Joining..." : "Join Venue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VenueInviteEntry;

