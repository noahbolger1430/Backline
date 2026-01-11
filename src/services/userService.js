import { apiClient } from '../utils/apiClient';

export const userService = {
  async getCurrentUser() {
    const response = await apiClient('/users/me', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch user information");
    }

    return await response.json();
  },

  async updateUser(userData) {
    const response = await apiClient('/users/me', {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update user information");
    }

    return await response.json();
  },
};
