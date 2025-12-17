import React from "react";

const EventModal = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <h2 className="modal-title">{event.title}</h2>

        <div className="modal-section">
          <h3 className="modal-section-title">Bands on the Bill</h3>
          <div className="modal-bands-list">
            {event.bands.map((band, index) => (
              <div key={index} className="modal-band-item">
                {band}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventModal;

