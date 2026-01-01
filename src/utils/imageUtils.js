/**
 * Utility functions for handling image URLs.
 * Supports both GCS URLs (full URLs) and local paths (relative paths).
 */

/**
 * Get the full image URL, handling both GCS URLs and local paths.
 * 
 * @param {string} imagePath - The image path from the database (can be GCS URL or local path)
 * @param {string} apiBaseUrl - The API base URL (defaults to REACT_APP_API_URL or localhost:8000)
 * @returns {string} - The full URL to the image
 */
export const getImageUrl = (imagePath, apiBaseUrl = null) => {
  if (!imagePath) {
    return null;
  }

  // If it's already a full URL (GCS URL), use it directly
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Otherwise, it's a local path - construct URL with API base
  const baseUrl = apiBaseUrl || process.env.REACT_APP_API_URL || 'http://localhost:8000';
  return `${baseUrl}/${imagePath}`;
};

