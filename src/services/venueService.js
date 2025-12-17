const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const venueService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async createVenue(venueData) {
    const response = await fetch(`${API_BASE_URL}/venues`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(venueData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create venue");
    }

    return await response.json();
  },

  async joinVenueWithInvite(inviteCode) {
    const response = await fetch(`${API_BASE_URL}/venues/join`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        invite_code: inviteCode,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to join venue");
    }

    return await response.json();
  },

  async getUserVenues() {
    const response = await fetch(`${API_BASE_URL}/venues/my-venues`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch venues");
    }

    return await response.json();
  },
};

