import { apiClient } from '../utils/apiClient';

export const availabilityService = {
  /**
   * Set availability for a specific date
   * @param {number} bandId - The band ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} status - "available", "unavailable", or "tentative"
   * @param {string} note - Optional note
   */
  async setMemberAvailability(bandId, date, status, note = null) {
    const response = await apiClient(
      `/availability/bands/${bandId}/members/me/availability`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entries: [
            {
              date,
              status,
              note,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to set availability");
    }

    return await response.json();
  },

  /**
   * Get availability for a date range
   * @param {number} bandId - The band ID
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   */
  async getMemberAvailability(bandId, startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const response = await apiClient(
      `/availability/bands/${bandId}/members/me/availability?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch availability");
    }

    return await response.json();
  },

  /**
   * Get all band members' availability for a date range
   * @param {number} bandId - The band ID
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   */
  async getBandAvailability(bandId, startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const response = await apiClient(
      `/availability/bands/${bandId}/availability?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch band availability");
    }

    return await response.json();
  },
};
