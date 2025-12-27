import React, { useState } from "react";
import "./AvailabilityModal.css";

const AvailabilityModal = ({ date, isCurrentlyUnavailable = false, onConfirm, onCancel }) => {
  const [isUnavailable, setIsUnavailable] = useState(isCurrentlyUnavailable);
  const [note, setNote] = useState("");

  const formatDate = (dateObj) => {
    if (!dateObj) return "";
    const options = { year: "numeric", month: "long", day: "numeric" };
    return dateObj.toLocaleDateString(undefined, options);
  };

  const handleConfirm = () => {
    // Determine status based on checkbox state
    const status = isUnavailable ? "unavailable" : "available";
    onConfirm(status, note || null);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content availability-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Set Availability</h2>
        <p className="modal-date">Date: {formatDate(date)}</p>
        <p className="modal-description">
          {isCurrentlyUnavailable
            ? "This date is currently marked as unavailable. You can mark it as available if your schedule has changed."
            : "By default, you are available for all dates. Mark this date as unavailable if you cannot perform."}
        </p>
        
        {!isCurrentlyUnavailable && (
          <>
            <div className="availability-option">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isUnavailable}
                  onChange={(e) => setIsUnavailable(e.target.checked)}
                />
                <span>Mark as unavailable</span>
              </label>
            </div>

            {isUnavailable && (
              <div className="note-section">
                <label htmlFor="availability-note">Optional note:</label>
                <textarea
                  id="availability-note"
                  className="note-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Out of town, Work conflict, etc."
                  rows={3}
                />
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="modal-button cancel-button" onClick={onCancel}>
            Cancel
          </button>
          {isCurrentlyUnavailable ? (
            <button className="modal-button confirm-button" onClick={() => onConfirm("available", null)}>
              Set Available
            </button>
          ) : isUnavailable ? (
            <button className="modal-button confirm-button" onClick={handleConfirm}>
              Set Unavailable
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AvailabilityModal;
