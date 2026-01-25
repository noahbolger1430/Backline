import { authService } from '../services/authService';
import { API_BASE_URL } from '../config';

// Event emitter for auth errors
const authEventListeners = [];

export const onAuthError = (callback) => {
  authEventListeners.push(callback);
  return () => {
    const index = authEventListeners.indexOf(callback);
    if (index > -1) authEventListeners.splice(index, 1);
  };
};

const notifyAuthError = () => {
  authEventListeners.forEach(callback => callback());
};

export const apiClient = async (url, options = {}) => {
  const token = authService.getToken();
  
  // If no valid token and this isn't a public endpoint, reject immediately
  if (!token && !url.includes('/auth/')) {
    notifyAuthError();
    throw new Error('No valid authentication token');
  }

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      authService.logout();
      notifyAuthError();
      throw new Error('Session expired. Please login again.');
    }

    return response;
  } catch (error) {
    if (error.message.includes('Session expired') || error.message.includes('No valid authentication')) {
      throw error;
    }
    throw error;
  }
};
