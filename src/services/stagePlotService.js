const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export const stagePlotService = {
  getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  async createStagePlot(stagePlotData) {
    const response = await fetch(`${API_BASE_URL}/stage-plots/`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(stagePlotData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create stage plot");
    }

    return await response.json();
  },

  async getStagePlot(stagePlotId) {
    const response = await fetch(`${API_BASE_URL}/stage-plots/${stagePlotId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch stage plot");
    }

    return await response.json();
  },

  async getBandStagePlots(bandId) {
    const response = await fetch(`${API_BASE_URL}/stage-plots/band/${bandId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch stage plots");
    }

    return await response.json();
  },

  async updateStagePlot(stagePlotId, stagePlotData) {
    const response = await fetch(`${API_BASE_URL}/stage-plots/${stagePlotId}`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify(stagePlotData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update stage plot");
    }

    return await response.json();
  },

  async deleteStagePlot(stagePlotId) {
    const response = await fetch(`${API_BASE_URL}/stage-plots/${stagePlotId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete stage plot");
    }

    return true;
  },

  // Helper to convert frontend items format to API format
  formatItemsForApi(stageItems) {
    return stageItems.map(item => ({
      id: item.id,
      instance_id: item.instanceId,
      name: item.name,
      icon: item.icon,
      x: item.x,
      y: item.y,
    }));
  },

  // Helper to convert API items format to frontend format
  formatItemsFromApi(items) {
    return items.map(item => ({
      id: item.id,
      instanceId: item.instance_id,
      name: item.name,
      icon: item.icon,
      x: item.x,
      y: item.y,
    }));
  },
};
