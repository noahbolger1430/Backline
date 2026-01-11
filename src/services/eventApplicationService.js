import { apiClient } from '../utils/apiClient';

export const eventApplicationService = {
  async submitApplication(eventId, bandId, applicationData) {
    const response = await apiClient(
      `/event-applications/events/${eventId}/applications?band_id=${bandId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(applicationData),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to submit application";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  async listBandApplications(bandId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString
      ? `/event-applications/bands/${bandId}/applications?${queryString}`
      : `/event-applications/bands/${bandId}/applications`;

    const response = await apiClient(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch applications";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  async listEventApplications(eventId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString
      ? `/event-applications/events/${eventId}/applications?${queryString}`
      : `/event-applications/events/${eventId}/applications`;

    const response = await apiClient(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch applications";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  async getApplication(applicationId) {
    const response = await apiClient(
      `/event-applications/applications/${applicationId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to fetch application";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  async updateApplication(applicationId, applicationData) {
    const response = await apiClient(
      `/event-applications/applications/${applicationId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(applicationData),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to update application";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  async withdrawApplication(applicationId) {
    const response = await apiClient(
      `/event-applications/applications/${applicationId}/withdraw`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to withdraw application";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  async reviewApplication(applicationId, reviewData) {
    const response = await apiClient(
      `/event-applications/applications/${applicationId}/review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to review application";
      try {
        const error = await response.json();
        errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
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
