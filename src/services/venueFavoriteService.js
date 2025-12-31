const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api/v1";

export const venueFavoriteService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async favoriteVenue(bandId, venueId) {
    const response = await fetch(
      `${API_BASE_URL}/bands/${bandId}/venues/${venueId}/favorite`,
      {
        method: "POST",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to favorite venue");
    }

    return await response.json();
  },

  async unfavoriteVenue(bandId, venueId) {
    const response = await fetch(
      `${API_BASE_URL}/bands/${bandId}/venues/${venueId}/favorite`,
      {
        method: "DELETE",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to unfavorite venue");
    }

    return await response.json();
  },

  async getFavoriteVenues(bandId) {
    const response = await fetch(
      `${API_BASE_URL}/bands/${bandId}/favorite-venues`,
      {
        method: "GET",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get favorite venues");
    }

    return await response.json();
  },
};

