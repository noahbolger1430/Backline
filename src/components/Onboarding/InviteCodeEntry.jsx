import React, { useState } from "react";
import { bandService } from "../../services/bandService";
import "./Onboarding.css";

const InviteCodeEntry = ({ onSuccess, onBack }) => {
  const [inviteCode, setInviteCode] = useState("");
  const [instrument, setInstrument] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const band = await bandService.joinBandWithInvite(inviteCode, instrument);
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
        <h2 className="onboarding-heading">Join Your Band</h2>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="inviteCode">Invite Code</label>
            <input
              type="text"
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter your invite code"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="instrument">What do you play? (Optional)</label>
            <input
              type="text"
              id="instrument"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="e.g., Guitar, Drums, Vocals"
              disabled={isLoading}
            />
          </div>

          <div className="button-group">
            <button type="button" className="button secondary" onClick={onBack} disabled={isLoading}>
              Back
            </button>

            <button type="submit" className="button primary" disabled={isLoading}>
              {isLoading ? "Joining..." : "Join Band"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteCodeEntry;

