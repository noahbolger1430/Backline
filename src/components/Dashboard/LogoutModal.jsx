import React from "react";
import "./LogoutModal.css";

const LogoutModal = ({ onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Confirm Logout</h2>
        <p>Are you sure you want to log out?</p>
        <div className="modal-actions">
          <button className="modal-button cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-button confirm-button" onClick={onConfirm}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
