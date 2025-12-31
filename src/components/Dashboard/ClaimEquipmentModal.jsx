import React, { useState, useEffect } from "react";
import { equipmentService } from "../../services/equipmentService";
import "./ClaimEquipmentModal.css";

/**
 * ClaimEquipmentModal Component
 * Allows users to select which of their equipment items to claim for backline
 */
const ClaimEquipmentModal = ({ 
  eventId, 
  bandId, 
  category, 
  categoryLabel, 
  onClose, 
  onClaimSuccess 
}) => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await equipmentService.checkUserHasCategory(bandId, category);
        setEquipment(data.equipment || []);
        
        // Auto-select first item if only one
        if (data.equipment && data.equipment.length === 1) {
          setSelectedEquipmentId(data.equipment[0].id);
        }
      } catch (err) {
        setError(err.message || "Failed to load equipment");
        console.error("Error fetching equipment:", err);
      } finally {
        setLoading(false);
      }
    };

    if (bandId && category) {
      fetchEquipment();
    }
  }, [bandId, category]);

  const handleClaim = async () => {
    if (!selectedEquipmentId) {
      setError("Please select an equipment item");
      return;
    }

    try {
      setClaiming(true);
      setError(null);
      await equipmentService.claimEquipmentForEvent(eventId, selectedEquipmentId);
      if (onClaimSuccess) {
        onClaimSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to claim equipment");
      console.error("Error claiming equipment:", err);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="claim-modal-overlay" onClick={onClose}>
        <div className="claim-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="claim-modal-loading">Loading equipment...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="claim-modal-overlay" onClick={onClose}>
      <div className="claim-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="claim-modal-close" onClick={onClose}>×</button>
        
        <h3 className="claim-modal-title">Claim {categoryLabel} for Backline</h3>
        <p className="claim-modal-subtitle">
          Select which of your {categoryLabel.toLowerCase()} items to provide as backline for this event.
        </p>

        {error && <div className="claim-modal-error">{error}</div>}

        {equipment.length === 0 ? (
          <div className="claim-modal-empty">
            <p>You don't have any {categoryLabel.toLowerCase()} equipment available for sharing.</p>
            <p className="claim-modal-hint">Add equipment in your profile to claim it for events.</p>
          </div>
        ) : (
          <>
            <div className="claim-equipment-list">
              {equipment.map((item) => (
                <div
                  key={item.id}
                  className={`claim-equipment-item ${selectedEquipmentId === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedEquipmentId(item.id)}
                >
                  <div className="claim-equipment-radio">
                    <input
                      type="radio"
                      name="equipment"
                      id={`equipment-${item.id}`}
                      checked={selectedEquipmentId === item.id}
                      onChange={() => setSelectedEquipmentId(item.id)}
                    />
                    <label htmlFor={`equipment-${item.id}`}></label>
                  </div>
                  <div className="claim-equipment-info">
                    <div className="claim-equipment-name">{item.name}</div>
                    {(item.brand || item.model) && (
                      <div className="claim-equipment-brand">
                        {item.brand && <span>{item.brand}</span>}
                        {item.brand && item.model && <span> - </span>}
                        {item.model && <span>{item.model}</span>}
                      </div>
                    )}
                    {item.specs && (
                      <div className="claim-equipment-specs">{item.specs}</div>
                    )}
                    {item.notes && (
                      <div className="claim-equipment-notes">{item.notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="claim-modal-actions">
              <button
                className="claim-cancel-btn"
                onClick={onClose}
                disabled={claiming}
              >
                Cancel
              </button>
              <button
                className="claim-submit-btn"
                onClick={handleClaim}
                disabled={!selectedEquipmentId || claiming}
              >
                {claiming ? "Claiming..." : "Claim Equipment"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimEquipmentModal;

