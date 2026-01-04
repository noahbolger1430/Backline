const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api/v1";

export const tourService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  /**
   * Convert algorithm weights from camelCase to snake_case for API.
   * 
   * @param {Object} weights - Algorithm weights in camelCase
   * @returns {Object} Weights converted to snake_case
   */
  formatAlgorithmWeights(weights) {
    if (!weights) {
      return null;
    }

    return {
      genre_match_weight: weights.genreMatchWeight,
      capacity_match_weight: weights.capacityMatchWeight,
      distance_weight: weights.distanceWeight,
      weekend_preference_weight: weights.weekendPreferenceWeight,
      recommendation_score_weight: weights.recommendationScoreWeight,
    };
  },

  /**
   * Format tour parameters for API request.
   * 
   * @param {Object} tourParams - Tour generation parameters from frontend
   * @returns {Object} Formatted parameters for API
   */
  formatTourParams(tourParams) {
    const formattedParams = {
      start_date: tourParams.start_date,
      end_date: tourParams.end_date,
      tour_radius_km: tourParams.tour_radius_km,
      starting_location: tourParams.starting_location,
      min_days_between_shows: tourParams.min_days_between_shows,
      max_days_between_shows: tourParams.max_days_between_shows,
      max_drive_hours_per_day: tourParams.max_drive_hours_per_day,
      prioritize_weekends: tourParams.prioritize_weekends,
      include_booked_events: tourParams.include_booked_events,
      preferred_genres: tourParams.preferred_genres,
      preferred_venue_capacity_min: tourParams.preferred_venue_capacity_min,
      preferred_venue_capacity_max: tourParams.preferred_venue_capacity_max,
    };

    if (tourParams.algorithm_weights) {
      formattedParams.algorithm_weights = this.formatAlgorithmWeights(
        tourParams.algorithm_weights
      );
    }

    return formattedParams;
  },

  /**
   * Generate an optimized tour schedule for a band.
   * 
   * @param {number} bandId - The band ID
   * @param {Object} tourParams - Tour generation parameters
   * @returns {Promise<Object>} Tour generation results
   */
  async generateTour(bandId, tourParams) {
    const formattedParams = this.formatTourParams(tourParams);

    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/generate-tour`,
      {
        method: "POST",
        headers: this.getAuthHeader(),
        body: JSON.stringify(formattedParams),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to generate tour";
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
   * Save a generated tour.
   * 
   * @param {number} bandId - The band ID
   * @param {string} tourId - Temporary tour ID
   * @param {string} name - Name for the saved tour
   * @param {Object} tourData - The tour generation results
   * @returns {Promise<Object>} Saved tour details
   */
  async saveTour(bandId, tourId, name, tourData) {
    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/tours/${tourId}/save`,
      {
        method: "POST",
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          save_request: {
            name: name,
          },
          tour_data: tourData,
        }),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to save tour";
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
   * Update an existing saved tour.
   * 
   * @param {number} bandId - The band ID
   * @param {number} tourId - The saved tour ID to update
   * @param {string} name - Name for the saved tour
   * @param {Object} tourData - The tour generation results
   * @returns {Promise<Object>} Updated tour details
   */
  async updateSavedTour(bandId, tourId, name, tourData) {
    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/tours/${tourId}`,
      {
        method: "PUT",
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          save_request: {
            name: name,
          },
          tour_data: tourData,
        }),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to update tour";
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
   * Get list of saved tours for a band.
   * 
   * @param {number} bandId - The band ID
   * @returns {Promise<Array>} List of saved tour summaries
   */
  async getSavedTours(bandId) {
    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/tours`,
      {
        method: "GET",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to fetch saved tours";
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
   * Get details of a saved tour.
   * 
   * @param {number} bandId - The band ID
   * @param {number} tourId - The saved tour ID
   * @returns {Promise<Object>} Saved tour details with full tour results
   */
  async getSavedTour(bandId, tourId) {
    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/tours/${tourId}`,
      {
        method: "GET",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to fetch saved tour";
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
   * Delete a saved tour.
   * 
   * @param {number} bandId - The band ID
   * @param {number} tourId - The saved tour ID
   * @returns {Promise<void>}
   */
  async deleteSavedTour(bandId, tourId) {
    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/tours/${tourId}`,
      {
        method: "DELETE",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to delete saved tour";
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
  },

  /**
   * Get tour availability summary for planning.
   * 
   * @param {number} bandId - The band ID
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Object>} Availability summary
   */
  async getTourAvailabilitySummary(bandId, startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/tour-availability-summary?${params}`,
      {
        method: "GET",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to fetch availability summary";
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
