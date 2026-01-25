import { API_BASE_URL } from '../config';

// Helper to decode JWT and check expiry
const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiryTime;
  } catch (error) {
    console.error("Error decoding token:", error);
    return true;
  }
};

export const authService = {
  async login(email, password) {
    // OAuth2PasswordRequestForm expects form-encoded data, not JSON
    const formData = new URLSearchParams();
    formData.append("username", email); // OAuth2 uses "username" field for email
    formData.append("password", password);

    try {
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error("Request timed out. Please check if the backend server is running.");
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Cannot connect to server. Please ensure the backend is running on http://127.0.0.1:8000");
      }
      
      throw err;
    }
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
    const token = localStorage.getItem("access_token");
    
    // Check if token is expired
    if (token && isTokenExpired(token)) {
      this.logout();
      return null;
    }
    
    return token;
  },

  isAuthenticated() {
    const token = this.getToken();
    return !!token && !isTokenExpired(token);
  },
};
