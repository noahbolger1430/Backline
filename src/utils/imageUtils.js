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

/**
 * Compresses an image file if it exceeds a certain size.
 * 
 * @param {File} file - The image file to compress
 * @param {number} maxSizeMB - The maximum size in MB
 * @returns {Promise<File>} - The compressed file (or original if smaller)
 */
export const compressImage = async (file, maxSizeMB = 4.0) => {
  if (!file || file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  console.log(`Compressing image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if too large
        const maxDimension = 1600;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Start with high quality and reduce until under limit
        let quality = 0.9;
        const compress = () => {
          canvas.toBlob(
            (blob) => {
              if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.1) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                console.log(`Compression finished: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(compressedFile);
              } else {
                quality -= 0.1;
                compress();
              }
            },
            'image/jpeg',
            quality
          );
        };
        compress();
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

