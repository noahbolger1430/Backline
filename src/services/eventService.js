const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api/v1";

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
    
    // Add recurring event fields
    if (eventData.is_recurring !== undefined) {
      formData.append("is_recurring", eventData.is_recurring);
    }
    if (eventData.recurring_day_of_week !== undefined && eventData.recurring_day_of_week !== null) {
      formData.append("recurring_day_of_week", eventData.recurring_day_of_week);
    }
    if (eventData.recurring_frequency) {
      formData.append("recurring_frequency", eventData.recurring_frequency);
    }
    if (eventData.recurring_start_date) {
      formData.append("recurring_start_date", eventData.recurring_start_date);
    }
    if (eventData.recurring_end_date) {
      formData.append("recurring_end_date", eventData.recurring_end_date);
    }
    
    // Add is_open_for_applications field
    formData.append("is_open_for_applications", eventData.is_open_for_applications || false);
    
    // Add genre tags for recommendation matching
    if (eventData.genre_tags) {
      formData.append("genre_tags", eventData.genre_tags);
    }
    
    formData.append("is_ticketed", eventData.is_ticketed);
    if (eventData.ticket_price !== null && eventData.ticket_price !== undefined) {
      formData.append("ticket_price", String(parseInt(eventData.ticket_price, 10)));
    }
    formData.append("is_age_restricted", eventData.is_age_restricted);
    if (eventData.age_restriction !== null && eventData.age_restriction !== undefined) {
      formData.append("age_restriction", String(parseInt(eventData.age_restriction, 10)));
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

  async updateEvent(eventId, eventData, imageFile = null, removeImage = false) {
    // Always use FormData to match backend expectations
    const formData = new FormData();
    let headers = this.getAuthHeader();

    // Add all event data fields to FormData
    if (eventData.name !== undefined) {
      formData.append("name", eventData.name);
    }
    if (eventData.description !== undefined) {
      formData.append("description", eventData.description || "");
    }
    if (eventData.event_date !== undefined) {
      formData.append("event_date", eventData.event_date);
    }
    if (eventData.doors_time !== undefined) {
      formData.append("doors_time", eventData.doors_time || "");
    }
    if (eventData.show_time !== undefined) {
      formData.append("show_time", eventData.show_time);
    }
    if (eventData.status !== undefined) {
      formData.append("status", eventData.status);
    }
    if (eventData.is_open_for_applications !== undefined) {
      formData.append("is_open_for_applications", eventData.is_open_for_applications);
    }
    if (eventData.genre_tags !== undefined) {
      formData.append("genre_tags", eventData.genre_tags || "");
    }
    if (eventData.is_ticketed !== undefined) {
      formData.append("is_ticketed", eventData.is_ticketed);
    }
    if (eventData.ticket_price !== undefined && eventData.ticket_price !== null) {
      formData.append("ticket_price", String(parseInt(eventData.ticket_price, 10)));
    }
    if (eventData.is_age_restricted !== undefined) {
      formData.append("is_age_restricted", eventData.is_age_restricted);
    }
    if (eventData.age_restriction !== undefined && eventData.age_restriction !== null) {
      formData.append("age_restriction", String(parseInt(eventData.age_restriction, 10)));
    }
    
    // Add image file or removal flag
    if (imageFile) {
      formData.append("image", imageFile);
    }
    if (removeImage) {
      formData.append("remove_image", "true");
    }
    
    const body = formData;
    // Remove Content-Type to let browser set it with boundary
    delete headers["Content-Type"];

    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: "PATCH",
      headers: headers,
      body: body,
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

  async getEventBands(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/bands`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch event bands";
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

  async addBandToEvent(eventId, bandId, bandEventData = {}) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/bands`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        band_id: bandId,
        status: bandEventData.status || "confirmed",
        set_time: bandEventData.set_time || null,
        set_length_minutes: bandEventData.set_length_minutes || null,
        performance_order: bandEventData.performance_order || null,
      }),
    });

    if (!response.ok) {
      let errorMessage = "Failed to add band to event";
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

  async removeBandFromEvent(eventId, bandId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/bands/${bandId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to remove band from event";
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

  async updateEventSchedule(eventId, scheduleUpdates) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/schedule`, {
      method: "PATCH",
      headers: this.getAuthHeader(),
      body: JSON.stringify({ schedule: scheduleUpdates }),
    });

    if (!response.ok) {
      let errorMessage = "Failed to update event schedule";
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

  async createBandEvent(bandId, eventData, imageFile = null, additionalBandIds = null) {
    const formData = new FormData();
    
    // Add all event data fields to FormData
    formData.append("name", eventData.name);
    if (eventData.description) {
      formData.append("description", eventData.description);
    }
    formData.append("event_date", eventData.event_date);
    if (eventData.doors_time) {
      formData.append("doors_time", eventData.doors_time);
    }
    formData.append("show_time", eventData.show_time);
    
    // Location details (required for band events)
    formData.append("location_name", eventData.location_name);
    if (eventData.street_address) {
      formData.append("street_address", eventData.street_address);
    }
    formData.append("city", eventData.city);
    formData.append("state", eventData.state);
    if (eventData.zip_code) {
      formData.append("zip_code", eventData.zip_code);
    }
    
    // Status (default to confirmed for band events)
    formData.append("status", eventData.status || "confirmed");
    
    // Genre tags
    if (eventData.genre_tags) {
      formData.append("genre_tags", eventData.genre_tags);
    }
    
    // Ticketing
    formData.append("is_ticketed", eventData.is_ticketed);
    if (eventData.ticket_price !== null && eventData.ticket_price !== undefined) {
      formData.append("ticket_price", String(parseInt(eventData.ticket_price, 10)));
    }
    
    // Age restriction
    formData.append("is_age_restricted", eventData.is_age_restricted);
    if (eventData.age_restriction !== null && eventData.age_restriction !== undefined) {
      formData.append("age_restriction", String(parseInt(eventData.age_restriction, 10)));
    }
    
    // Additional bands
    if (additionalBandIds) {
      formData.append("additional_band_ids", additionalBandIds);
    }
    
    // Image file
    if (imageFile) {
      formData.append("image", imageFile);
    }
    
    // Get auth header but remove Content-Type
    const headers = this.getAuthHeader();
    delete headers["Content-Type"];

    const response = await fetch(`${API_BASE_URL}/band-events/bands/${bandId}/events`, {
      method: "POST",
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Failed to create band event";
      try {
        const error = await response.json();
        if (error.detail) {
          if (Array.isArray(error.detail)) {
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

  async listBandEvents(bandId, includeVenueEvents = true, params = {}) {
    const queryParams = {
      ...params,
      include_venue_events: includeVenueEvents
    };
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${API_BASE_URL}/band-events/bands/${bandId}/events?${queryString}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch band events";
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

  async updateBandEvent(bandId, eventId, eventData, imageFile = null, removeImage = false) {
    const formData = new FormData();
    let headers = this.getAuthHeader();

    // Add all event data fields to FormData
    if (eventData.name !== undefined) {
      formData.append("name", eventData.name);
    }
    if (eventData.description !== undefined) {
      formData.append("description", eventData.description || "");
    }
    if (eventData.event_date !== undefined) {
      formData.append("event_date", eventData.event_date);
    }
    if (eventData.doors_time !== undefined) {
      formData.append("doors_time", eventData.doors_time || "");
    }
    if (eventData.show_time !== undefined) {
      formData.append("show_time", eventData.show_time);
    }
    
    // Location fields
    if (eventData.location_name !== undefined) {
      formData.append("location_name", eventData.location_name);
    }
    if (eventData.street_address !== undefined) {
      formData.append("street_address", eventData.street_address || "");
    }
    if (eventData.city !== undefined) {
      formData.append("city", eventData.city);
    }
    if (eventData.state !== undefined) {
      formData.append("state", eventData.state);
    }
    if (eventData.zip_code !== undefined) {
      formData.append("zip_code", eventData.zip_code || "");
    }
    
    // Other fields
    if (eventData.status !== undefined) {
      formData.append("status", eventData.status);
    }
    if (eventData.genre_tags !== undefined) {
      formData.append("genre_tags", eventData.genre_tags || "");
    }
    if (eventData.is_ticketed !== undefined) {
      formData.append("is_ticketed", eventData.is_ticketed);
    }
    if (eventData.ticket_price !== undefined && eventData.ticket_price !== null) {
      formData.append("ticket_price", String(parseInt(eventData.ticket_price, 10)));
    }
    if (eventData.is_age_restricted !== undefined) {
      formData.append("is_age_restricted", eventData.is_age_restricted);
    }
    if (eventData.age_restriction !== undefined && eventData.age_restriction !== null) {
      formData.append("age_restriction", String(parseInt(eventData.age_restriction, 10)));
    }
    
    // Image handling
    if (imageFile) {
      formData.append("image", imageFile);
    }
    if (removeImage) {
      formData.append("remove_image", "true");
    }
    
    delete headers["Content-Type"];

    const response = await fetch(`${API_BASE_URL}/band-events/bands/${bandId}/events/${eventId}`, {
      method: "PATCH",
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Failed to update band event";
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

  async deleteBandEvent(bandId, eventId) {
    const response = await fetch(`${API_BASE_URL}/band-events/bands/${bandId}/events/${eventId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to delete band event";
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
};
