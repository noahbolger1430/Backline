import React, { useState, useEffect, useCallback } from "react";
import { equipmentService } from "../../services/equipmentService";
import "./MemberEquipment.css";

/**
 * Equipment category display labels and icons
 */
const CATEGORY_CONFIG = {
  guitar_amp: { label: "Guitar Amp", icon: "🔊", group: "Amplifiers" },
  bass_amp: { label: "Bass Amp", icon: "🔊", group: "Amplifiers" },
  keyboard_amp: { label: "Keyboard Amp", icon: "🔊", group: "Amplifiers" },
  guitar: { label: "Guitar", icon: "🎸", group: "Instruments" },
  bass: { label: "Bass", icon: "🎸", group: "Instruments" },
  keyboard: { label: "Keyboard", icon: "🎹", group: "Instruments" },
  drum_kit: { label: "Drum Kit", icon: "🥁", group: "Drums" },
  snare: { label: "Snare", icon: "🥁", group: "Drums" },
  kick: { label: "Kick Drum", icon: "🥁", group: "Drums" },
  tom: { label: "Tom", icon: "🥁", group: "Drums" },
  cymbal: { label: "Cymbal", icon: "🥁", group: "Drums" },
  hi_hat: { label: "Hi-Hat", icon: "🥁", group: "Drums" },
  drum_hardware: { label: "Drum Hardware", icon: "🔧", group: "Drums" },
  pedalboard: { label: "Pedalboard", icon: "🎛️", group: "Effects" },
  pedal: { label: "Pedal", icon: "🎛️", group: "Effects" },
  microphone: { label: "Microphone", icon: "🎤", group: "Other" },
  di_box: { label: "DI Box", icon: "📦", group: "Other" },
  other: { label: "Other", icon: "🎵", group: "Other" },
};

/**
 * Grouped categories for the dropdown
 */
const CATEGORY_GROUPS = [
  {
    name: "Amplifiers",
    categories: ["guitar_amp", "bass_amp", "keyboard_amp"],
  },
  {
    name: "Instruments",
    categories: ["guitar", "bass", "keyboard"],
  },
  {
    name: "Drums",
    categories: ["drum_kit", "snare", "kick", "tom", "cymbal", "hi_hat", "drum_hardware"],
  },
  {
    name: "Effects",
    categories: ["pedalboard", "pedal"],
  },
  {
    name: "Other",
    categories: ["microphone", "di_box", "other"],
  },
];

/**
 * MemberEquipment Component
 * Allows band members to manage their equipment for Gear Share coordination
 */
const MemberEquipment = ({ bandId, bandName, isEditing, onEquipmentChange }) => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state for adding/editing equipment
  const [formData, setFormData] = useState({
    category: "guitar",
    name: "",
    brand: "",
    model: "",
    specs: "",
    notes: "",
    available_for_share: true,
  });

  // Bulk add state for drum kits and pedalboards
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkType, setBulkType] = useState(null); // 'drum_kit' or 'pedalboard'
  const [bulkItems, setBulkItems] = useState([]);

  /**
   * Fetch equipment for this band membership
   */
  const fetchEquipment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await equipmentService.getMyEquipment(bandId);
      setEquipment(data.equipment || []);
      if (onEquipmentChange) {
        onEquipmentChange(data.equipment || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load equipment");
      console.error("Error fetching equipment:", err);
    } finally {
      setLoading(false);
    }
  }, [bandId, onEquipmentChange]);

  useEffect(() => {
    if (bandId) {
      fetchEquipment();
    }
  }, [bandId, fetchEquipment]);

  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setFormData({
      category: "guitar",
      name: "",
      brand: "",
      model: "",
      specs: "",
      notes: "",
      available_for_share: true,
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
      await equipmentService.createEquipment(bandId, formData);
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
      await equipmentService.updateEquipment(bandId, editingItem.id, formData);
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
      await equipmentService.deleteEquipment(bandId, equipmentId);
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
      available_for_share: item.available_for_share,
    });
    setEditingItem(item);
    setShowAddForm(true);
    setShowBulkAdd(false);
  };

  /**
   * Handle bulk add for drum kits or pedalboards
   */
  const startBulkAdd = (type) => {
    setBulkType(type);
    setBulkItems([{ name: "", brand: "", model: "", specs: "", notes: "" }]);
    setShowBulkAdd(true);
    setShowAddForm(false);
    setEditingItem(null);
  };

  /**
   * Add a new item to bulk list
   */
  const addBulkItem = () => {
    setBulkItems([...bulkItems, { name: "", brand: "", model: "", specs: "", notes: "" }]);
  };

  /**
   * Remove an item from bulk list
   */
  const removeBulkItem = (index) => {
    setBulkItems(bulkItems.filter((_, i) => i !== index));
  };

  /**
   * Update a bulk item
   */
  const updateBulkItem = (index, field, value) => {
    const updated = [...bulkItems];
    updated[index][field] = value;
    setBulkItems(updated);
  };

  /**
   * Submit bulk add
   */
  const handleBulkAdd = async (e) => {
    e.preventDefault();
    
    // Filter out empty items and validate
    const validItems = bulkItems.filter((item) => item.name.trim());
    if (validItems.length === 0) {
      setError("Please add at least one item with a name");
      return;
    }

    // Map bulk type to individual categories
    const getCategoryForBulkType = (type, itemName) => {
      if (type === "drum_kit") {
        const name = itemName.toLowerCase();
        if (name.includes("snare")) return "snare";
        if (name.includes("kick") || name.includes("bass drum")) return "kick";
        if (name.includes("tom")) return "tom";
        if (name.includes("hi-hat") || name.includes("hihat")) return "hi_hat";
        if (name.includes("cymbal") || name.includes("crash") || name.includes("ride")) return "cymbal";
        if (name.includes("stand") || name.includes("pedal") || name.includes("throne")) return "drum_hardware";
        return "drum_kit";
      }
      return "pedal"; // For pedalboard items
    };

    try {
      setSaving(true);
      setError(null);
      
      const items = validItems.map((item) => ({
        category: getCategoryForBulkType(bulkType, item.name),
        name: item.name,
        brand: item.brand || null,
        model: item.model || null,
        specs: item.specs || null,
        notes: item.notes || null,
        available_for_share: true,
      }));

      await equipmentService.createEquipmentBulk(bandId, items);
      await fetchEquipment();
      setShowBulkAdd(false);
      setBulkItems([]);
      setBulkType(null);
    } catch (err) {
      setError(err.message || "Failed to add equipment");
      console.error("Error adding bulk equipment:", err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Group equipment by category group
   */
  const groupedEquipment = equipment.reduce((acc, item) => {
    const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
    const group = config.group;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="member-equipment-section">
        <div className="member-equipment-header">
          <h4 className="member-equipment-title">🎸 My Equipment</h4>
        </div>
        <div className="member-equipment-loading">Loading equipment...</div>
      </div>
    );
  }

  return (
    <div className="member-equipment-section">
      <div className="member-equipment-header">
        <h4 className="member-equipment-title">My Gear</h4>
        <p className="member-equipment-subtitle">
          Add your gear for gear share coordination with other bands
        </p>
      </div>

      {error && <div className="member-equipment-error">{error}</div>}

      {/* Equipment List */}
      {equipment.length > 0 && (
        <div className="member-equipment-list">
          {Object.entries(groupedEquipment).map(([group, items]) => (
            <div key={group} className="equipment-group">
              <h5 className="equipment-group-title">{group}</h5>
              <div className="equipment-items">
                {items.map((item) => {
                  const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
                  return (
                    <div key={item.id} className="equipment-item">
                      <div className="equipment-item-header">
                        <span className="equipment-icon">{config.icon}</span>
                        <div className="equipment-item-info">
                          <span className="equipment-item-name">{item.name}</span>
                          <span className="equipment-item-category">{config.label}</span>
                        </div>
                        {item.available_for_share && (
                          <span className="equipment-share-badge" title="Available for Gear Share">
                            🤝
                          </span>
                        )}
                      </div>
                      {(item.brand || item.model) && (
                        <div className="equipment-item-brand">
                          {item.brand && <span>{item.brand}</span>}
                          {item.brand && item.model && <span> - </span>}
                          {item.model && <span>{item.model}</span>}
                        </div>
                      )}
                      {item.specs && (
                        <div className="equipment-item-specs">{item.specs}</div>
                      )}
                      {item.notes && (
                        <div className="equipment-item-notes">{item.notes}</div>
                      )}
                      {isEditing && (
                        <div className="equipment-item-actions">
                          <button
                            className="equipment-action-btn edit-btn"
                            onClick={() => startEditing(item)}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            className="equipment-action-btn delete-btn"
                            onClick={() => handleDeleteEquipment(item.id)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {equipment.length === 0 && !showAddForm && !showBulkAdd && (
        <div className="member-equipment-empty">
          <p>No equipment added yet.</p>
          {isEditing && <p>Add your gear to help coordinate backline sharing!</p>}
        </div>
      )}

      {/* Action Buttons */}
      {isEditing && !showAddForm && !showBulkAdd && (
        <div className="member-equipment-actions">
          <button
            className="equipment-add-btn"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
          >
            + Add Single Item
          </button>
          <button
            className="equipment-add-btn bulk-btn"
            onClick={() => startBulkAdd("drum_kit")}
          >
            + Add Drum Kit
          </button>
          <button
            className="equipment-add-btn bulk-btn"
            onClick={() => startBulkAdd("pedalboard")}
          >
            + Add Pedalboard
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {isEditing && showAddForm && (
        <form
          className="equipment-form"
          onSubmit={editingItem ? handleUpdateEquipment : handleAddEquipment}
        >
          <h5 className="equipment-form-title">
            {editingItem ? "Edit Equipment" : "Add Equipment"}
          </h5>

          <div className="equipment-form-row">
            <div className="equipment-form-field">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                disabled={saving}
              >
                {CATEGORY_GROUPS.map((group) => (
                  <optgroup key={group.name} label={group.name}>
                    {group.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="equipment-form-field">
              <label htmlFor="name">Name / Description *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Main Stratocaster, 14x6.5 Snare"
                disabled={saving}
                required
              />
            </div>
          </div>

          <div className="equipment-form-row">
            <div className="equipment-form-field">
              <label htmlFor="brand">Brand</label>
              <input
                type="text"
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                placeholder="e.g., Fender, Pearl, Boss"
                disabled={saving}
              />
            </div>

            <div className="equipment-form-field">
              <label htmlFor="model">Model</label>
              <input
                type="text"
                id="model"
                name="model"
                value={formData.model}
                onChange={handleInputChange}
                placeholder="e.g., Stratocaster, Export Series"
                disabled={saving}
              />
            </div>
          </div>

          <div className="equipment-form-field">
            <label htmlFor="specs">Specifications</label>
            <textarea
              id="specs"
              name="specs"
              value={formData.specs}
              onChange={handleInputChange}
              placeholder="e.g., Size, color, wattage, specific features..."
              rows="2"
              disabled={saving}
            />
          </div>

          <div className="equipment-form-field">
            <label htmlFor="notes">Notes for Gear Share</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Any special instructions or notes for other bands..."
              rows="2"
              disabled={saving}
            />
          </div>

          <div className="equipment-form-field checkbox-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="available_for_share"
                checked={formData.available_for_share}
                onChange={handleInputChange}
                disabled={saving}
              />
              <span>Available for Gear Share</span>
            </label>
          </div>

          <div className="equipment-form-actions">
            <button
              type="button"
              className="equipment-cancel-btn"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="equipment-submit-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : editingItem ? "Update" : "Add Equipment"}
            </button>
          </div>
        </form>
      )}

      {/* Bulk Add Form */}
      {isEditing && showBulkAdd && (
        <form className="equipment-form bulk-form" onSubmit={handleBulkAdd}>
          <h5 className="equipment-form-title">
            Add {bulkType === "drum_kit" ? "Drum Kit" : "Pedalboard"} Items
          </h5>
          <p className="bulk-form-hint">
            {bulkType === "drum_kit"
              ? "Add each drum, cymbal, and hardware piece separately"
              : "Add each pedal on your board"}
          </p>

          <div className="bulk-items-list">
            {bulkItems.map((item, index) => (
              <div key={index} className="bulk-item">
                <div className="bulk-item-header">
                  <span className="bulk-item-number">#{index + 1}</span>
                  {bulkItems.length > 1 && (
                    <button
                      type="button"
                      className="bulk-remove-btn"
                      onClick={() => removeBulkItem(index)}
                      disabled={saving}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="bulk-item-fields">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateBulkItem(index, "name", e.target.value)}
                    placeholder={
                      bulkType === "drum_kit"
                        ? "e.g., 14x6.5 Snare, 22x18 Kick, 20\" Crash"
                        : "e.g., Tube Screamer, Big Muff, DD-7"
                    }
                    disabled={saving}
                    className="bulk-input name-input"
                  />
                  <input
                    type="text"
                    value={item.brand}
                    onChange={(e) => updateBulkItem(index, "brand", e.target.value)}
                    placeholder="Brand"
                    disabled={saving}
                    className="bulk-input brand-input"
                  />
                  <input
                    type="text"
                    value={item.model}
                    onChange={(e) => updateBulkItem(index, "model", e.target.value)}
                    placeholder="Model"
                    disabled={saving}
                    className="bulk-input model-input"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="bulk-add-more-btn"
            onClick={addBulkItem}
            disabled={saving}
          >
            + Add Another Item
          </button>

          <div className="equipment-form-actions">
            <button
              type="button"
              className="equipment-cancel-btn"
              onClick={() => {
                setShowBulkAdd(false);
                setBulkItems([]);
                setBulkType(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="equipment-submit-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : `Add ${bulkItems.filter((i) => i.name.trim()).length} Items`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MemberEquipment;

