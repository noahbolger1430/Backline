import React, { useState, useEffect, useCallback } from "react";
import { venueService } from "../../services/venueService";
import "./VenueEquipment.css";

/**
 * Equipment category display labels and icons (backline only)
 */
const CATEGORY_CONFIG = {
  guitar_amp: { label: "Guitar Amp", icon: "🔊", group: "Amplifiers" },
  bass_amp: { label: "Bass Amp", icon: "🔊", group: "Amplifiers" },
  keyboard_amp: { label: "Keyboard Amp", icon: "🔊", group: "Amplifiers" },
  keyboard: { label: "Keyboard", icon: "🎹", group: "Instruments" },
  drum_kit: { label: "Drum Kit", icon: "🥁", group: "Drums" },
  microphone: { label: "Microphone", icon: "🎤", group: "Other" },
};

/**
 * Grouped categories for the dropdown (backline only)
 */
const CATEGORY_GROUPS = [
  {
    name: "Amplifiers",
    categories: ["guitar_amp", "bass_amp", "keyboard_amp"],
  },
  {
    name: "Instruments",
    categories: ["keyboard"],
  },
  {
    name: "Drums",
    categories: ["drum_kit"],
  },
  {
    name: "Other",
    categories: ["microphone"],
  },
];

/**
 * VenueEquipment Component
 * Allows venue owners/managers to manage their backline equipment
 */
const VenueEquipment = ({ venueId }) => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  
  // Form state for adding/editing equipment
  const [formData, setFormData] = useState({
    category: "guitar_amp",
    name: "",
    brand: "",
    model: "",
    specs: "",
    notes: "",
  });

  /**
   * Fetch equipment categories
   */
  const fetchCategories = useCallback(async () => {
    try {
      const data = await venueService.getVenueEquipmentCategories(venueId);
      setCategories(data.categories || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }, [venueId]);

  /**
   * Fetch equipment for this venue
   */
  const fetchEquipment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await venueService.getVenueEquipment(venueId);
      setEquipment(data.equipment || []);
    } catch (err) {
      setError(err.message || "Failed to load equipment");
      console.error("Error fetching equipment:", err);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    if (venueId) {
      fetchCategories();
      fetchEquipment();
    }
  }, [venueId, fetchCategories, fetchEquipment]);

  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setFormData({
      category: "guitar_amp",
      name: "",
      brand: "",
      model: "",
      specs: "",
      notes: "",
    });
    setShowAddForm(false);
    setEditingItem(null);
  };

  /**
   * Handle adding new equipment
   */
  const handleAddEquipment = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Equipment name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await venueService.createVenueEquipment(venueId, formData);
      await fetchEquipment();
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to add equipment");
      console.error("Error adding equipment:", err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle updating equipment
   */
  const handleUpdateEquipment = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Equipment name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await venueService.updateVenueEquipment(venueId, editingItem.id, formData);
      await fetchEquipment();
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to update equipment");
      console.error("Error updating equipment:", err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle deleting equipment
   */
  const handleDeleteEquipment = async (equipmentId) => {
    if (!window.confirm("Are you sure you want to delete this equipment?")) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await venueService.deleteVenueEquipment(venueId, equipmentId);
      await fetchEquipment();
    } catch (err) {
      setError(err.message || "Failed to delete equipment");
      console.error("Error deleting equipment:", err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Start editing an equipment item
   */
  const startEditing = (item) => {
    setFormData({
      category: item.category,
      name: item.name,
      brand: item.brand || "",
      model: item.model || "",
      specs: item.specs || "",
      notes: item.notes || "",
    });
    setEditingItem(item);
    setShowAddForm(true);
  };

  /**
   * Group equipment by category
   */
  const groupEquipmentByCategory = () => {
    const grouped = {};
    equipment.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
  };

  /**
   * Get category label
   */
  const getCategoryLabel = (category) => {
    return CATEGORY_CONFIG[category]?.label || category;
  };

  /**
   * Get category icon
   */
  const getCategoryIcon = (category) => {
    return CATEGORY_CONFIG[category]?.icon || "🎵";
  };

  if (loading && equipment.length === 0) {
    return (
      <div className="venue-equipment-container">
        <div className="venue-equipment-loading">Loading equipment...</div>
      </div>
    );
  }

  const groupedEquipment = groupEquipmentByCategory();

  return (
    <div className="venue-equipment-container">
      <div className="venue-equipment-header">
        <h3 className="venue-equipment-title">Venue Backline Equipment</h3>
        {!showAddForm && (
          <button
            className="venue-equipment-add-button"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            disabled={saving}
          >
            + Add Equipment
          </button>
        )}
      </div>

      {error && <div className="venue-equipment-error">{error}</div>}

      {showAddForm && (
        <div className="venue-equipment-form-container">
          <h4 className="venue-equipment-form-title">
            {editingItem ? "Edit Equipment" : "Add New Equipment"}
          </h4>
          <form
            onSubmit={editingItem ? handleUpdateEquipment : handleAddEquipment}
            className="venue-equipment-form"
          >
            <div className="venue-equipment-form-field">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                disabled={saving}
                className="venue-equipment-select"
              >
                {CATEGORY_GROUPS.map((group) => (
                  <optgroup key={group.name} label={group.name}>
                    {group.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="venue-equipment-form-field">
              <label htmlFor="name">Equipment Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                disabled={saving}
                placeholder="e.g., Main Guitar Amp, House Drum Kit"
                className="venue-equipment-input"
              />
            </div>

            <div className="venue-equipment-form-row">
              <div className="venue-equipment-form-field">
                <label htmlFor="brand">Brand</label>
                <input
                  type="text"
                  id="brand"
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="e.g., Fender, Pearl"
                  className="venue-equipment-input"
                />
              </div>

              <div className="venue-equipment-form-field">
                <label htmlFor="model">Model</label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="e.g., Twin Reverb, Export Series"
                  className="venue-equipment-input"
                />
              </div>
            </div>

            <div className="venue-equipment-form-field">
              <label htmlFor="specs">Specifications</label>
              <textarea
                id="specs"
                name="specs"
                value={formData.specs}
                onChange={handleInputChange}
                disabled={saving}
                placeholder="Detailed specifications"
                rows={3}
                className="venue-equipment-textarea"
              />
            </div>

            <div className="venue-equipment-form-field">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                disabled={saving}
                placeholder="Additional notes about the equipment"
                rows={2}
                className="venue-equipment-textarea"
              />
            </div>

            <div className="venue-equipment-form-actions">
              <button
                type="button"
                className="venue-equipment-button venue-equipment-button-cancel"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="venue-equipment-button venue-equipment-button-submit"
                disabled={saving}
              >
                {saving ? "Saving..." : editingItem ? "Update Equipment" : "Add Equipment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showAddForm && (
        <div className="venue-equipment-list">
          {equipment.length === 0 ? (
            <div className="venue-equipment-empty">
              <p>No equipment added yet. Click "Add Equipment" to get started.</p>
            </div>
          ) : (
            Object.keys(groupedEquipment)
              .sort()
              .map((category) => (
                <div key={category} className="venue-equipment-category-group">
                  <h4 className="venue-equipment-category-title">
                    {getCategoryIcon(category)} {getCategoryLabel(category)}
                  </h4>
                  <div className="venue-equipment-items">
                    {groupedEquipment[category].map((item) => (
                      <div key={item.id} className="venue-equipment-item">
                        <div className="venue-equipment-item-header">
                          <h5 className="venue-equipment-item-name">{item.name}</h5>
                          <div className="venue-equipment-item-actions">
                            <button
                              className="venue-equipment-edit-button"
                              onClick={() => startEditing(item)}
                              disabled={saving}
                              title="Edit equipment"
                            >
                              ✏️
                            </button>
                            <button
                              className="venue-equipment-delete-button"
                              onClick={() => handleDeleteEquipment(item.id)}
                              disabled={saving}
                              title="Delete equipment"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        {(item.brand || item.model) && (
                          <div className="venue-equipment-item-details">
                            {item.brand && item.model
                              ? `${item.brand} ${item.model}`
                              : item.brand || item.model}
                          </div>
                        )}
                        {item.specs && (
                          <div className="venue-equipment-item-specs">{item.specs}</div>
                        )}
                        {item.notes && (
                          <div className="venue-equipment-item-notes">{item.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};

export default VenueEquipment;

