import { apiClient } from '../utils/apiClient';

export const recommendationService = {
  /**
   * Get recommended gigs for a band.
   * Returns gigs sorted by recommendation score with explanations.
   * 
   * @param {number} bandId - The band ID
   * @param {Object} options - Optional parameters
   * @param {number} options.limit - Maximum number of recommendations (default: 20)
   * @param {boolean} options.includeApplied - Include gigs already applied to (default: true)
   */
  async getRecommendedGigs(bandId, options = {}) {
    const { limit = 20, includeApplied = true } = options;
    
    const params = new URLSearchParams({
      limit: limit.toString(),
      include_applied: includeApplied.toString(),
    });

    const response = await apiClient(
      `/recommendations/bands/${bandId}/recommended-gigs?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to fetch recommended gigs";
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
   * Record that a band viewed a gig (for recommendation improvement).
   * 
   * @param {number} bandId - The band ID
   * @param {number} eventId - The event ID that was viewed
   */
  async recordGigView(bandId, eventId) {
    const response = await apiClient(
      `/recommendations/bands/${bandId}/gig-views`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_id: eventId }),
      }
    );

    if (!response.ok) {
      // Don't throw error for view tracking - it's not critical
      console.warn("Failed to record gig view:", response.statusText);
      return null;
    }

    return await response.json();
  },
};
