const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const eventService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async createEvent(eventData, imageFile = null, bandIds = null) {
    const formData = new FormData();
    
    // Add all event data fields to FormData
    formData.append("venue_id", eventData.venue_id);
    formData.append("name", eventData.name);
    if (eventData.description) {
      formData.append("description", eventData.description);
    }
    formData.append("event_date", eventData.event_date);
    if (eventData.doors_time) {
      formData.append("doors_time", eventData.doors_time);
    }
    formData.append("show_time", eventData.show_time);
    
    // Add status field (pending or confirmed)
    if (eventData.status) {
      formData.append("status", eventData.status);
    }
    
    // Add is_open_for_applications field
    formData.append("is_open_for_applications", eventData.is_open_for_applications || false);
    
    formData.append("is_ticketed", eventData.is_ticketed);
    if (eventData.ticket_price !== null && eventData.ticket_price !== undefined) {
      formData.append("ticket_price", eventData.ticket_price);
    }
    formData.append("is_age_restricted", eventData.is_age_restricted);
    if (eventData.age_restriction !== null && eventData.age_restriction !== undefined) {
      formData.append("age_restriction", eventData.age_restriction);
    }
    
    // Add band IDs if provided
    if (bandIds) {
      formData.append("band_ids", bandIds);
    }
    
    // Add image file if provided
    if (imageFile) {
      formData.append("image", imageFile);
    }
    
    // Get auth header but remove Content-Type to let browser set it with boundary
    const headers = this.getAuthHeader();
    delete headers["Content-Type"];

    const response = await fetch(`${API_BASE_URL}/events/`, {
      method: "POST",
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Failed to create event";
      try {
        const error = await response.json();
        if (error.detail) {
          if (Array.isArray(error.detail)) {
            // Validation errors come as an array
            errorMessage = error.detail.map(err => {
              const field = err.loc ? err.loc.join('.') : 'field';
              const msg = err.msg || err;
              return `${field}: ${msg}`;
            }).join(", ");
          } else {
            errorMessage = error.detail;
          }
        }
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  async deleteEvent(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to delete event";
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

    return true;
  },

  async getEvent(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch event";
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

  async listEvents(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString 
      ? `${API_BASE_URL}/events/?${queryString}` 
      : `${API_BASE_URL}/events/`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch events";
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

  async updateEvent(eventId, eventData) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: "PATCH",
      headers: this.getAuthHeader(),
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      let errorMessage = "Failed to update event";
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

  async openEventForApplications(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/open-applications`, {
      method: "POST",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to open event for applications";
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

  async closeEventApplications(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/close-applications`, {
      method: "POST",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to close event applications";
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

  async confirmEvent(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/confirm`, {
      method: "POST",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to confirm event";
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
