const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const eventApplicationService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async submitApplication(eventId, bandId, applicationData) {
    const response = await fetch(
      `${API_BASE_URL}/event-applications/events/${eventId}/applications?band_id=${bandId}`,
      {
        method: "POST",
        headers: this.getAuthHeader(),
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
      ? `${API_BASE_URL}/event-applications/bands/${bandId}/applications?${queryString}`
      : `${API_BASE_URL}/event-applications/bands/${bandId}/applications`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeader(),
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
      ? `${API_BASE_URL}/event-applications/events/${eventId}/applications?${queryString}`
      : `${API_BASE_URL}/event-applications/events/${eventId}/applications`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeader(),
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
    const response = await fetch(
      `${API_BASE_URL}/event-applications/applications/${applicationId}`,
      {
        method: "GET",
        headers: this.getAuthHeader(),
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
    const response = await fetch(
      `${API_BASE_URL}/event-applications/applications/${applicationId}`,
      {
        method: "PATCH",
        headers: this.getAuthHeader(),
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
    const response = await fetch(
      `${API_BASE_URL}/event-applications/applications/${applicationId}/withdraw`,
      {
        method: "POST",
        headers: this.getAuthHeader(),
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
    const response = await fetch(
      `${API_BASE_URL}/event-applications/applications/${applicationId}/review`,
      {
        method: "POST",
        headers: this.getAuthHeader(),
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
