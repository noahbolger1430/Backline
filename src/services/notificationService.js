import { apiClient } from '../utils/apiClient';

export const notificationService = {
  async getNotifications(unreadOnly = false, limit = 50) {
    const response = await apiClient(
      `/notifications?unread_only=${unreadOnly}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch notifications");
    }

    return response.json();
  },

  async getUnreadCount() {
    const response = await apiClient('/notifications/unread-count', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch unread count");
    }

    return response.json();
  },

  async markAsRead(notificationId) {
    const response = await apiClient(`/notifications/${notificationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_read: true }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to mark notification as read");
    }

    return response.json();
  },

  async markAllAsRead() {
    const response = await apiClient('/notifications/mark-all-read', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to mark all notifications as read");
    }

    return response.json();
  },
};
