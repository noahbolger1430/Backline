const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const userService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async getCurrentUser() {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch user information");
    }

    return await response.json();
  },

  async updateUser(userData) {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update user information");
    }

    return await response.json();
  },
};

