const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const venueService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async createVenue(venueData, imageFile = null) {
    const formData = new FormData();
    
    // Add all venue data fields to FormData
    formData.append("name", venueData.name);
    if (venueData.description) {
      formData.append("description", venueData.description);
    }
    formData.append("street_address", venueData.street_address);
    formData.append("city", venueData.city);
    formData.append("state", venueData.state);
    formData.append("zip_code", venueData.zip_code);
    if (venueData.capacity !== null && venueData.capacity !== undefined) {
      formData.append("capacity", venueData.capacity);
    }
    formData.append("has_sound_provided", venueData.has_sound_provided);
    formData.append("has_parking", venueData.has_parking);
    if (venueData.age_restriction !== null && venueData.age_restriction !== undefined) {
      formData.append("age_restriction", venueData.age_restriction);
    }
    
    // Add image file if provided
    if (imageFile) {
      formData.append("image", imageFile);
    }
    
    // Get auth header but remove Content-Type to let browser set it with boundary
    const headers = this.getAuthHeader();
    delete headers["Content-Type"];

    const response = await fetch(`${API_BASE_URL}/venues/`, {
      method: "POST",
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Handle validation errors - FastAPI returns detail as array or string
      let errorMessage = "Failed to create venue";
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          // Validation errors come as an array
          errorMessage = errorData.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const msg = err.msg || err;
            return `${field}: ${msg}`;
          }).join(", ");
        } else {
          errorMessage = errorData.detail;
        }
      }
      throw new Error(errorMessage);
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
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      const response = await fetch(`${API_BASE_URL}/venues/my-venues`, {
        method: "GET",
        headers: this.getAuthHeader(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = typeof error.detail === 'string' ? error.detail : (error.detail?.message || JSON.stringify(error.detail) || "Failed to fetch venues");
        const err = new Error(errorMessage);
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error("Request timeout - venue service may be slow or unavailable");
        timeoutErr.status = 408;
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw error;
    }
  },

  async getVenueDetails(venueId) {
    const response = await fetch(`${API_BASE_URL}/venues/${venueId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch venue details");
    }

    return await response.json();
  },

  async updateVenue(venueId, venueData) {
    const response = await fetch(`${API_BASE_URL}/venues/${venueId}`, {
      method: "PATCH",
      headers: this.getAuthHeader(),
      body: JSON.stringify(venueData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = "Failed to update venue";
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const msg = err.msg || err;
            return `${field}: ${msg}`;
          }).join(", ");
        } else {
          errorMessage = errorData.detail;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  },

  async updateVenueImage(venueId, imageFile) {
    const formData = new FormData();
    formData.append("image", imageFile);

    const token = localStorage.getItem("access_token");
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE_URL}/venues/${venueId}/image`, {
      method: "POST",
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = "Failed to update venue image";
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const msg = err.msg || err;
            return `${field}: ${msg}`;
          }).join(", ");
        } else {
          errorMessage = errorData.detail;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  },

  async getVenueOperatingHours(venueId) {
    const response = await fetch(`${API_BASE_URL}/venues/${venueId}/operating-hours`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch venue operating hours");
    }

    return await response.json();
  },

  async updateVenueOperatingHours(venueId, hoursData) {
    const response = await fetch(`${API_BASE_URL}/venues/${venueId}/operating-hours`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify(hoursData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = "Failed to update venue operating hours";
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const msg = err.msg || err;
            return `${field}: ${msg}`;
          }).join(", ");
        } else {
          errorMessage = errorData.detail;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  },

  async getVenueStaff(venueId) {
    const response = await fetch(`${API_BASE_URL}/venues/${venueId}/staff`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch venue staff");
    }

    return await response.json();
  },

  async listVenues(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.city) queryParams.append("city", params.city);
    if (params.state) queryParams.append("state", params.state);
    if (params.has_sound_provided !== undefined) queryParams.append("has_sound_provided", params.has_sound_provided);
    if (params.has_parking !== undefined) queryParams.append("has_parking", params.has_parking);
    if (params.min_capacity !== undefined) queryParams.append("min_capacity", params.min_capacity);
    if (params.max_capacity !== undefined) queryParams.append("max_capacity", params.max_capacity);
    if (params.skip !== undefined) queryParams.append("skip", params.skip);
    if (params.limit !== undefined) queryParams.append("limit", params.limit);

    const url = `${API_BASE_URL}/venues/${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await fetch(url, {
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
