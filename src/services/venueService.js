import { apiClient } from '../utils/apiClient';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api/v1";

export const venueService = {
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

    // For FormData, don't set Content-Type header (browser will set it with boundary)
    const response = await apiClient('/venues/', {
      method: 'POST',
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
    const response = await apiClient('/venues/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invite_code: inviteCode,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to join venue');
    }

    return await response.json();
  },

  async getUserVenues() {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      const response = await apiClient('/venues/my-venues', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = typeof error.detail === 'string' 
          ? error.detail 
          : (error.detail?.message || JSON.stringify(error.detail) || "Failed to fetch venues");
        const err = new Error(errorMessage);
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error(
          "Request timeout - venue service may be slow or unavailable"
        );
        timeoutErr.status = 408;
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw error;
    }
  },

  async getVenueDetails(venueId) {
    const response = await apiClient(`/venues/${venueId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch venue details');
    }

    return await response.json();
  },

  async updateVenue(venueId, venueData) {
    const response = await apiClient(`/venues/${venueId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
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

    // For FormData, don't set Content-Type header (browser will set it with boundary)
    const response = await apiClient(`/venues/${venueId}/image`, {
      method: 'POST',
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
    const response = await apiClient(`/venues/${venueId}/operating-hours`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch venue operating hours');
    }

    return await response.json();
  },

  async updateVenueOperatingHours(venueId, hoursData) {
    const response = await apiClient(`/venues/${venueId}/operating-hours`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await apiClient(`/venues/${venueId}/staff`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch venue staff');
    }

    return await response.json();
  },

  async listVenues(params = {}) {
    const queryParams = new URLSearchParams();
    
    // Existing filter parameters
    if (params.city) {
      queryParams.append("city", params.city);
    }
    if (params.state) {
      queryParams.append("state", params.state);
    }
    if (params.has_sound_provided !== undefined) {
      queryParams.append("has_sound_provided", params.has_sound_provided);
    }
    if (params.has_parking !== undefined) {
      queryParams.append("has_parking", params.has_parking);
    }
    if (params.min_capacity !== undefined) {
      queryParams.append("min_capacity", params.min_capacity);
    }
    if (params.max_capacity !== undefined) {
      queryParams.append("max_capacity", params.max_capacity);
    }
    if (params.skip !== undefined) {
      queryParams.append("skip", params.skip);
    }
    if (params.limit !== undefined) {
      queryParams.append("limit", params.limit);
    }
    if (params.band_id !== undefined) {
      queryParams.append("band_id", params.band_id);
    }
    
    // Distance filter parameters
    if (params.distance_km !== undefined && params.distance_km !== null) {
      queryParams.append("distance_km", params.distance_km);
    }
    if (params.base_location !== undefined && params.base_location !== null) {
      queryParams.append("base_location", params.base_location);
    }

    const queryString = queryParams.toString();
    const url = `/venues/${queryString ? `?${queryString}` : ""}`;
    
    const response = await apiClient(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch venues');
    }

    return await response.json();
  },

  // Venue Equipment Methods
  async getVenueEquipmentCategories(venueId) {
    const response = await apiClient(`/venues/${venueId}/equipment/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch venue equipment categories');
    }

    return await response.json();
  },

  async getVenueEquipment(venueId) {
    const response = await apiClient(`/venues/${venueId}/equipment`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch venue equipment');
    }

    return await response.json();
  },

  async createVenueEquipment(venueId, equipmentData) {
    const response = await apiClient(`/venues/${venueId}/equipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(equipmentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = "Failed to create venue equipment";
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

  async updateVenueEquipment(venueId, equipmentId, equipmentData) {
    const response = await apiClient(`/venues/${venueId}/equipment/${equipmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(equipmentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = "Failed to update venue equipment";
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

  async deleteVenueEquipment(venueId, equipmentId) {
    const response = await apiClient(`/venues/${venueId}/equipment/${equipmentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete venue equipment');
    }

    return null; // 204 No Content
  },
};
