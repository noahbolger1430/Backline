const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const notificationService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  },

  async getNotifications(unreadOnly = false, limit = 50) {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/notifications?unread_only=${unreadOnly}&limit=${limit}`,
      {
        method: "GET",
        headers: this.getAuthHeader(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch notifications");
    }

    return response.json();
  },

  async getUnreadCount() {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/unread-count`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch unread count");
    }

    return response.json();
  },

  async markAsRead(notificationId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/${notificationId}`, {
      method: "PATCH",
      headers: this.getAuthHeader(),
      body: JSON.stringify({ is_read: true }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to mark notification as read");
    }

    return response.json();
  },

  async markAllAsRead() {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/mark-all-read`, {
      method: "POST",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to mark all notifications as read");
    }

    return response.json();
  },
};

