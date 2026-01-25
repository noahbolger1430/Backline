import { apiClient } from '../utils/apiClient';
import { compressImage } from '../utils/imageUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api/v1";

export const bandService = {
  async createBand(bandData) {
    const response = await apiClient('/bands/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bandData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create band');
    }

    return await response.json();
  },

  async joinBandWithInvite(inviteCode, instrument) {
    try {
      // Convert empty string to null to match backend schema validation
      const instrumentValue = instrument && instrument.trim() ? instrument.trim() : null;
      
      const response = await apiClient('/bands/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_code: inviteCode,
          instrument: instrumentValue,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to join band";
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        const err = new Error(errorMessage);
        err.status = response.status;
        err.isAlreadyMember = errorMessage.includes("already a member");
        throw err;
      }

      return await response.json();
    } catch (error) {
      // If it's already our custom error, re-throw it
      if (error.status || error.isAlreadyMember !== undefined) {
        throw error;
      }
      // Otherwise, it's a network error (Failed to fetch)
      // Preserve the original error message
      const networkErr = new Error(error.message || `Unable to connect to server. Please ensure the backend server is running at ${API_BASE_URL}`);
      networkErr.isNetworkError = true;
      throw networkErr;
    }
  },

  async getUserBands() {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      const response = await apiClient('/bands/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = "Failed to fetch bands";
        try {
          const error = await response.json();
          errorMessage = typeof error.detail === 'string' ? error.detail : (error.detail?.message || JSON.stringify(error.detail) || errorMessage);
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        const err = new Error(errorMessage);
        err.status = response.status;
        throw err;
      }

      const result = await response.json();
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error("Request timeout - band service may be slow or unavailable");
        timeoutErr.status = 408;
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw error;
    }
  },

  async getBandDetails(bandId) {
    const response = await apiClient(`/bands/${bandId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch band details');
    }

    return await response.json();
  },

  async getBandEvents(bandId) {
    const response = await apiClient(`/events/?band_id=${bandId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch band events');
    }

    const data = await response.json();
    return data.events || [];
  },

  async searchBands(searchTerm) {
    const response = await apiClient(`/bands/?search=${encodeURIComponent(searchTerm)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to search bands');
    }

    return await response.json();
  },

  async updateBand(bandId, bandData, imageFile = null, logoFile = null) {
    const formData = new FormData();
    
    // Add all band data fields to FormData (only if they're provided)
    if (bandData.name !== undefined) {
      formData.append("name", bandData.name);
    }
    if (bandData.description !== undefined) {
      formData.append("description", bandData.description || "");
    }
    if (bandData.genre !== undefined) {
      formData.append("genre", bandData.genre || "");
    }
    if (bandData.location !== undefined) {
      formData.append("location", bandData.location || "");
    }
    if (bandData.instagram_url !== undefined) {
      formData.append("instagram_url", bandData.instagram_url || "");
    }
    if (bandData.facebook_url !== undefined) {
      formData.append("facebook_url", bandData.facebook_url || "");
    }
    if (bandData.spotify_url !== undefined) {
      formData.append("spotify_url", bandData.spotify_url || "");
    }
    if (bandData.website_url !== undefined) {
      formData.append("website_url", bandData.website_url || "");
    }
    
    // Add image file if provided (with compression)
    if (imageFile) {
      try {
        const compressedImage = await compressImage(imageFile);
        formData.append("image", compressedImage);
      } catch (err) {
        console.warn("Image compression failed, sending original:", err);
        formData.append("image", imageFile);
      }
    }
    
    // Add logo file if provided (with compression)
    if (logoFile) {
      try {
        const compressedLogo = await compressImage(logoFile);
        formData.append("logo", compressedLogo);
      } catch (err) {
        console.warn("Logo compression failed, sending original:", err);
        formData.append("logo", logoFile);
      }
    }
    
    // For FormData, don't set Content-Type header (browser will set it with boundary)
    const response = await apiClient(`/bands/${bandId}`, {
      method: 'PUT',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update band');
    }

    const result = await response.json();
    return result;
  },

  async updateMyBandMemberInfo(bandId, instrument) {
    // Always include the instrument field in the payload
    const payload = {
      instrument: instrument && instrument.trim() ? instrument.trim() : null
    };

    console.log('Sending payload:', JSON.stringify(payload)); // Debug log

    const response = await apiClient(`/bands/${bandId}/members/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error Response:', error); // Debug log
      
      let errorMessage = "Failed to update band member information";
      
      if (error.detail) {
        if (typeof error.detail === 'string') {
          errorMessage = error.detail;
        } else if (Array.isArray(error.detail)) {
          // Pydantic validation errors
          errorMessage = error.detail
            .map(e => {
              const field = e.loc ? e.loc.join('.') : 'field';
              return `${field}: ${e.msg}`;
            })
            .join('; ');
        } else {
          errorMessage = JSON.stringify(error.detail);
        }
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  },
};
