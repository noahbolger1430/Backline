const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const authService = {
  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Login failed");
    }

    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    return data;
  },

  async signup(email, fullName, password) {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        full_name: fullName,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Signup failed");
    }

    return await response.json();
  },

  logout() {
    localStorage.removeItem("access_token");
  },

  getToken() {
    return localStorage.getItem("access_token");
  },

  isAuthenticated() {
    return !!localStorage.getItem("access_token");
  },
};

