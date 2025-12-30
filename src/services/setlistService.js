const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const setlistService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async createSetlist(setlistData) {
    const response = await fetch(`${API_BASE_URL}/setlists/`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(setlistData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create setlist");
    }

    return await response.json();
  },

  async getSetlist(setlistId) {
    const response = await fetch(`${API_BASE_URL}/setlists/${setlistId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch setlist");
    }

    return await response.json();
  },

  async getBandSetlists(bandId) {
    const response = await fetch(`${API_BASE_URL}/setlists/band/${bandId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch setlists");
    }

    return await response.json();
  },

  async updateSetlist(setlistId, setlistData) {
    const response = await fetch(`${API_BASE_URL}/setlists/${setlistId}`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify(setlistData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update setlist");
    }

    return await response.json();
  },

  async deleteSetlist(setlistId) {
    const response = await fetch(`${API_BASE_URL}/setlists/${setlistId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete setlist");
    }

    return true;
  },
};

