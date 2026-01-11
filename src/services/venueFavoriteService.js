import { apiClient } from '../utils/apiClient';

export const venueFavoriteService = {
  async favoriteVenue(bandId, venueId) {
    const response = await apiClient(
      `/bands/${bandId}/venues/${venueId}/favorite`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to favorite venue");
    }

    return await response.json();
  },

  async unfavoriteVenue(bandId, venueId) {
    const response = await apiClient(
      `/bands/${bandId}/venues/${venueId}/favorite`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to unfavorite venue");
    }

    return await response.json();
  },

  async getFavoriteVenues(bandId) {
    const response = await apiClient(
      `/bands/${bandId}/favorite-venues`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get favorite venues");
    }

    return await response.json();
  },
};
