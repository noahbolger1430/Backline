/**
 * Physical Ticket Service
 * 
 * Handles API calls for physical ticket management:
 * - Ticket pool creation and management
 * - Ticket allocation to bands
 * - Ticket sales tracking
 * - PDF generation
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api/v1";

export const physicalTicketService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  // ===== Ticket Pool Operations =====

  /**
   * Create a ticket pool for an event
   * @param {number} eventId - Event ID
   * @param {object} poolData - { total_quantity: number, ticket_prefix: string }
   * @returns {Promise<object>} Created ticket pool
   */
  async createTicketPool(eventId, poolData) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/events/${eventId}/ticket-pool`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(poolData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create ticket pool");
    }

    return await response.json();
  },

  /**
   * Get the ticket pool for an event with all allocations
   * @param {number} eventId - Event ID
   * @returns {Promise<object|null>} Ticket pool with allocations or null if not found
   */
  async getTicketPool(eventId) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/events/${eventId}/ticket-pool`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get ticket pool");
    }

    return await response.json();
  },

  /**
   * Delete the ticket pool for an event
   * @param {number} eventId - Event ID
   */
  async deleteTicketPool(eventId) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/events/${eventId}/ticket-pool`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete ticket pool");
    }
  },

  // ===== Allocation Operations =====

  /**
   * Allocate tickets to a band
   * @param {number} eventId - Event ID
   * @param {object} allocationData - { band_event_id: number, allocated_quantity: number }
   * @returns {Promise<object>} Created allocation
   */
  async allocateTickets(eventId, allocationData) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/events/${eventId}/ticket-pool/allocations`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(allocationData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to allocate tickets");
    }

    return await response.json();
  },

  /**
   * Get allocation details with sales
   * @param {number} allocationId - Allocation ID
   * @returns {Promise<object>} Allocation with sales
   */
  async getAllocation(allocationId) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/allocations/${allocationId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get allocation");
    }

    return await response.json();
  },

  /**
   * Update a ticket allocation
   * @param {number} allocationId - Allocation ID
   * @param {object} updateData - { allocated_quantity: number }
   * @returns {Promise<object>} Updated allocation
   */
  async updateAllocation(allocationId, updateData) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/allocations/${allocationId}`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update allocation");
    }

    return await response.json();
  },

  /**
   * Delete a ticket allocation
   * @param {number} allocationId - Allocation ID
   */
  async deleteAllocation(allocationId) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/allocations/${allocationId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete allocation");
    }
  },

  // ===== Summary Operations =====

  /**
   * Get event ticket summary
   * @param {number} eventId - Event ID
   * @returns {Promise<object>} Ticket summary
   */
  async getEventTicketSummary(eventId) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/events/${eventId}/tickets/summary`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get ticket summary");
    }

    return await response.json();
  },

  // ===== PDF Operations =====

  /**
   * Download tickets PDF for an event
   * @param {number} eventId - Event ID
   * @param {string} eventName - Event name for filename
   */
  async downloadTicketsPDF(eventId, eventName = "tickets") {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/physical-tickets/events/${eventId}/tickets/pdf`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to download tickets PDF");
    }

    // Get the blob and create download link
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Clean event name for filename
    const safeEventName = eventName.replace(/[^a-zA-Z0-9\s-_]/g, "").trim();
    link.download = `${safeEventName}_tickets.pdf`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ===== Band Operations =====

  /**
   * Get band's ticket allocation for an event
   * @param {number} bandId - Band ID
   * @param {number} eventId - Event ID
   * @returns {Promise<object|null>} Allocation with sales or null if not found
   */
  async getBandTicketAllocation(bandId, eventId) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/bands/${bandId}/events/${eventId}/ticket-allocation`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get ticket allocation");
    }

    return await response.json();
  },

  // ===== Ticket Sale Operations =====

  /**
   * Record a ticket sale
   * @param {number} allocationId - Allocation ID
   * @param {object} saleData - Sale data
   * @returns {Promise<object>} Created sale
   */
  async recordSale(allocationId, saleData) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/allocations/${allocationId}/sales`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(saleData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to record sale");
    }

    return await response.json();
  },

  /**
   * Update a ticket sale
   * @param {number} saleId - Sale ID
   * @param {object} updateData - Fields to update
   * @returns {Promise<object>} Updated sale
   */
  async updateSale(saleId, updateData) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/sales/${saleId}`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update sale");
    }

    return await response.json();
  },

  /**
   * Delete a ticket sale
   * @param {number} saleId - Sale ID
   */
  async deleteSale(saleId) {
    const response = await fetch(`${API_BASE_URL}/physical-tickets/sales/${saleId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete sale");
    }
  },
};

export default physicalTicketService;

