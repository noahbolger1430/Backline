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
      // If we get a band back, it means either:
      // 1. We successfully joined, OR
      // 2. We were already a member (backend now returns the band in this case)
      // In both cases, we should redirect to the dashboard
      if (band && band.id) {
        onSuccess(band);
      } else {
        setError("Invalid response from server");
      }
    } catch (err) {
      console.error("Error joining band:", err);
      
      // Handle network errors
      if (err.isNetworkError) {
        setError(err.message);
        return;
      }
      
      // Check if this is the "already a member" error (legacy support)
      if (err.isAlreadyMember || err.message?.includes("already a member")) {
        // Try to fetch the band by getting user's bands and finding the one with matching invite code
        try {
          const userBands = await bandService.getUserBands();
          if (Array.isArray(userBands) && userBands.length > 0) {
            const matchingBand = userBands.find((b) => b.invite_code === inviteCode);
            if (matchingBand) {
              onSuccess(matchingBand);
              return;
            }
            // If no matching band found by invite code, use the first band
            // (user might have multiple bands, but we'll redirect to the first one)
            onSuccess(userBands[0]);
            return;
          }
        } catch (fetchErr) {
          console.error("Error fetching user bands in fallback:", fetchErr);
          // If fetching bands fails, show a helpful message
          setError("You are already a member. Please refresh the page or log in again.");
          return;
        }
      }
      // Show the actual error message from the server
      const errorMessage = err.message || "Failed to join band";
      setError(errorMessage);
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

