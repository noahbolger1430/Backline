import { apiClient } from '../utils/apiClient';

export const setlistService = {
  async createSetlist(setlistData) {
    const response = await apiClient('/setlists/', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(setlistData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create setlist");
    }

    return await response.json();
  },

  async getSetlist(setlistId) {
    const response = await apiClient(`/setlists/${setlistId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch setlist");
    }

    return await response.json();
  },

  async getBandSetlists(bandId) {
    const response = await apiClient(`/setlists/band/${bandId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch setlists");
    }

    return await response.json();
  },

  async updateSetlist(setlistId, setlistData) {
    const response = await apiClient(`/setlists/${setlistId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(setlistData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update setlist");
    }

    return await response.json();
  },

  async deleteSetlist(setlistId) {
    const response = await apiClient(`/setlists/${setlistId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete setlist");
    }

    return true;
  },
};
