import React, { useState } from "react";
import "./Onboarding.css";

const RoleSelection = ({ onRoleSelect }) => {
  const [hasInviteCode, setHasInviteCode] = useState(null);

  const handleBandSelection = () => {
    onRoleSelect("band", hasInviteCode);
  };

  const handleVenueSelection = () => {
    onRoleSelect("venue", hasInviteCode);
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <h1 className="app-title">BackLine</h1>
        <h2 className="onboarding-heading">Welcome! Let's get you set up</h2>

        <div className="role-selection">
          <p className="question-text">Are you:</p>

          <div className="role-options">
            <button className="role-button band" onClick={() => setHasInviteCode(false)}>
              <span className="role-icon">🎸</span>
              <span className="role-text">In a Band</span>
            </button>

            <button className="role-button venue" onClick={() => setHasInviteCode(false)}>
              <span className="role-icon">🏛️</span>
              <span className="role-text">Managing a Venue</span>
            </button>
          </div>

          {hasInviteCode === false && (
            <div className="invite-check">
              <p className="question-text">Do you have an invite code?</p>

              <div className="invite-options">
                <button
                  className="invite-button yes"
                  onClick={() => {
                    setHasInviteCode(true);
                    handleBandSelection();
                  }}
                >
                  Yes, I have a code
                </button>

                <button className="invite-button no" onClick={handleBandSelection}>
                  No, I'll create a new band
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;

