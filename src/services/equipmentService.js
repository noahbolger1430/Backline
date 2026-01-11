import { apiClient } from '../utils/apiClient';

/**
 * Equipment Service
 * Handles API calls for band member equipment management (Gear Share feature)
 */

export const equipmentService = {
  /**
   * Get all available equipment categories
   */
  async getCategories() {
    const response = await apiClient('/equipment/categories', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch equipment categories");
    }

    return await response.json();
  },

  /**
   * Get all equipment for the current user in a specific band
   */
  async getMyEquipment(bandId) {
    const response = await apiClient(`/equipment/bands/${bandId}/my-equipment`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch equipment");
    }

    return await response.json();
  },

  /**
   * Create a new piece of equipment
   */
  async createEquipment(bandId, equipmentData) {
    const response = await apiClient(`/equipment/bands/${bandId}/my-equipment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(equipmentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create equipment");
    }

    return await response.json();
  },

  /**
   * Create multiple pieces of equipment at once (for drum kits, pedalboards, etc.)
   */
  async createEquipmentBulk(bandId, items) {
    const response = await apiClient(`/equipment/bands/${bandId}/my-equipment/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create equipment");
    }

    return await response.json();
  },

  /**
   * Update a piece of equipment
   */
  async updateEquipment(bandId, equipmentId, updateData) {
    const response = await apiClient(`/equipment/bands/${bandId}/my-equipment/${equipmentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update equipment");
    }

    return await response.json();
  },

  /**
   * Delete a piece of equipment
   */
  async deleteEquipment(bandId, equipmentId) {
    const response = await apiClient(`/equipment/bands/${bandId}/my-equipment/${equipmentId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete equipment");
    }

    return true;
  },

  /**
   * Get all equipment from all band members (for gear share view)
   */
  async getBandEquipment(bandId) {
    const response = await apiClient(`/equipment/bands/${bandId}/all-equipment`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch band equipment");
    }

    return await response.json();
  },

  /**
   * Get all backline equipment from all bands on an event
   */
  async getEventBackline(eventId) {
    const response = await apiClient(`/equipment/events/${eventId}/backline`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch event backline");
    }

    return await response.json();
  },

  /**
   * Check if the current user has equipment of a specific category for a band
   */
  async checkUserHasCategory(bandId, category) {
    const response = await apiClient(`/equipment/bands/${bandId}/has-category/${category}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to check user equipment category");
    }

    return await response.json();
  },

  /**
   * Claim equipment for backline at an event
   */
  async claimEquipmentForEvent(eventId, equipmentId) {
    const response = await apiClient(`/equipment/events/${eventId}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ equipment_id: equipmentId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to claim equipment");
    }

    return await response.json();
  },

  /**
   * Unclaim equipment for backline at an event
   */
  async unclaimEquipmentForEvent(eventId, equipmentId) {
    const response = await apiClient(`/equipment/events/${eventId}/claim/${equipmentId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to unclaim equipment");
    }

    return true;
  },
};
