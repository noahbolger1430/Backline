import { apiClient } from '../utils/apiClient';

/**
 * Venue Recommendation Service
 * 
 * Provides band recommendations for venue owners when:
 * 1. Searching for bands to add to an event
 * 2. Reviewing band applications for an event
 */

export const venueRecommendationService = {
  /**
   * Get recommended bands for an event.
   * 
   * Returns bands scored and ranked by how well they fit the event,
   * considering genre, location, activity level, and profile quality.
   * 
   * @param {number} venueId - The venue ID
   * @param {number} eventId - The event ID
   * @param {Object} options - Optional parameters
   * @param {number} options.limit - Maximum number of recommendations (default: 20)
   * @param {string} options.search - Optional search term to filter bands
   */
  async getRecommendedBands(venueId, eventId, options = {}) {
    const { limit = 20, search = null } = options;
    
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    
    if (search) {
      params.append("search", search);
    }

    const response = await apiClient(
      `/venue-recommendations/venues/${venueId}/events/${eventId}/recommended-bands?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to fetch recommended bands";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === "string"
          ? error.detail
          : error.detail?.message || JSON.stringify(error.detail) || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  /**
   * Get scored applicants for an event.
   * 
   * Returns applications sorted by how well each band fits the event,
   * helping venue owners prioritize which applications to review first.
   * 
   * @param {number} venueId - The venue ID
   * @param {number} eventId - The event ID
   */
  async getScoredApplicants(venueId, eventId) {
    const response = await apiClient(
      `/venue-recommendations/venues/${venueId}/events/${eventId}/scored-applicants`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to fetch scored applicants";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === "string"
          ? error.detail
          : error.detail?.message || JSON.stringify(error.detail) || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },
};
