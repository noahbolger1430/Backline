const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const bandService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async createBand(bandData) {
    const response = await fetch(`${API_BASE_URL}/bands`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(bandData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create band");
    }

    return await response.json();
  },

  async joinBandWithInvite(inviteCode, instrument) {
    const response = await fetch(`${API_BASE_URL}/bands/join`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        invite_code: inviteCode,
        instrument,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to join band");
    }

    return await response.json();
  },

  async getUserBands() {
    const response = await fetch(`${API_BASE_URL}/bands`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch bands");
    }

    return await response.json();
  },
};

