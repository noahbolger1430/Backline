const getApiBaseUrl = () => {
  let url = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
  // Remove trailing slash
  url = url.replace(/\/$/, "");
  
  // If it doesn't already have /api/v1, add it
  // But check if it's already included (e.g. in the default or if someone included it in the env var)
  if (url && !url.includes('/api/v1')) {
    url = `${url}/api/v1`;
  }
  
  return url;
};

export const API_BASE_URL = getApiBaseUrl();

