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
   * Generate an optimized tour schedule for a band.
   * 
   * @param {number} bandId - The band ID
   * @param {Object} tourParams - Tour generation parameters
   * @returns {Promise<Object>} Tour generation results
   */
  async generateTour(bandId, tourParams) {
    const response = await fetch(
      `${API_BASE_URL}/tours/bands/${bandId}/generate-tour`,
      {
        method: "POST",
        headers: this.getAuthHeader(),
        body: JSON.stringify(tourParams),
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
