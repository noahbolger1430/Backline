/**
 * YouTube Service for searching songs and creating practice playlists.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const youtubeService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  /**
   * Check if YouTube API is configured on the backend
   */
  async getStatus() {
    const response = await fetch(`${API_BASE_URL}/youtube/status`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to check YouTube status");
    }

    return await response.json();
  },

  /**
   * Search for songs on YouTube
   * @param {string[]} songs - Array of song names to search
   * @param {string} bandName - Optional band name to include in search
   */
  async searchSongs(songs, bandName = null) {
    const response = await fetch(`${API_BASE_URL}/youtube/search`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        songs,
        band_name: bandName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to search songs on YouTube");
    }

    return await response.json();
  },

  /**
   * Search for songs in a setlist on YouTube
   * @param {number} setlistId - The setlist ID
   * @param {string} bandName - Optional band name to include in search
   * @param {Array} songsToSearch - Optional array of songs to search (objects with title and artist)
   */
  async searchSetlistSongs(setlistId, bandName = null, songsToSearch = null) {
    const url = new URL(`${API_BASE_URL}/youtube/search/setlist/${setlistId}`);
    if (bandName) {
      url.searchParams.append("band_name", bandName);
    }

    const body = {};
    if (songsToSearch && songsToSearch.length > 0) {
      body.songs_to_search = songsToSearch.map(song => ({
        title: song.title || song.name || "",
        artist: song.artist || ""
      }));
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.getAuthHeader(),
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to search setlist songs on YouTube");
    }

    return await response.json();
  },

  /**
   * Generate a YouTube playlist URL from video IDs
   * @param {string[]} videoIds - Array of YouTube video IDs
   */
  generatePlaylistUrl(videoIds) {
    if (!videoIds || videoIds.length === 0) {
      return null;
    }
    
    // YouTube allows embedding playlists with comma-separated video IDs
    // Using the first video with playlist parameter
    const firstVideoId = videoIds[0];
    const playlistIds = videoIds.join(",");
    
    return `https://www.youtube.com/embed/${firstVideoId}?playlist=${videoIds.slice(1).join(",")}&autoplay=0&enablejsapi=1`;
  },

  /**
   * Get the embed URL for a single video
   * @param {string} videoId - YouTube video ID
   */
  getEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
  },
};

