import React, { useState } from "react";
import logoImage from "../../logos/Backline logo.jpg";
import "./Onboarding.css";

const RoleSelection = ({ onRoleSelect, onBackToLogin }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [hasInviteCode, setHasInviteCode] = useState(null);

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setHasInviteCode(null);
  };

  const handleInviteChoice = (hasCode) => {
    onRoleSelect(selectedRole, hasCode);
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <img src={logoImage} alt="BackLine" className="app-title" />
        <h2 className="onboarding-heading">Welcome! Let's get you set up</h2>

        <div className="role-selection">
          <p className="question-text">Are you:</p>

          <div className="role-options">
            <button
              className={`role-button band ${selectedRole === "band" ? "selected" : ""}`}
              onClick={() => handleRoleSelection("band")}
            >
              <span className="role-icon">🎸</span>
              <span className="role-text">In a Band</span>
            </button>

            <button
              className={`role-button venue ${selectedRole === "venue" ? "selected" : ""}`}
              onClick={() => handleRoleSelection("venue")}
            >
              <span className="role-icon">🏛️</span>
              <span className="role-text">Managing a Venue</span>
            </button>
          </div>

          {selectedRole && (
            <div className="invite-check">
              <p className="question-text">
                {selectedRole === "band"
                  ? "Do you have a band invite code?"
                  : "Do you have a venue invite code?"}
              </p>

              <div className="invite-options">
                <button className="invite-button yes" onClick={() => handleInviteChoice(true)}>
                  Yes, I have a code
                </button>

                <button className="invite-button no" onClick={() => handleInviteChoice(false)}>
                  {selectedRole === "band" ? "No, I'll create a new band" : "No, I'll create a new venue"}
                </button>
              </div>
            </div>
          )}

          {onBackToLogin && (
            <div className="back-to-login">
              <button 
                className="button secondary" 
                onClick={onBackToLogin}
                style={{ marginTop: '20px' }}
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;

