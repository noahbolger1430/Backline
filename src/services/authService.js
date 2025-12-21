const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const authService = {
  async login(email, password) {
    // OAuth2PasswordRequestForm expects form-encoded data, not JSON
    const formData = new URLSearchParams();
    formData.append("username", email); // OAuth2 uses "username" field for email
    formData.append("password", password);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
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
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
      const errorData = await response.json();
      // Handle validation errors - FastAPI returns detail as array or string
      let errorMessage = "Signup failed";
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          // Validation errors come as an array
          errorMessage = errorData.detail.map(err => err.msg || err).join(", ");
        } else {
          errorMessage = errorData.detail;
        }
      }
      throw new Error(errorMessage);
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

