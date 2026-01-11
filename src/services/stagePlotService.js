import { apiClient } from '../utils/apiClient';

export const stagePlotService = {
  async createStagePlot(stagePlotData) {
    const response = await apiClient('/stage-plots/', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stagePlotData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create stage plot");
    }

    return await response.json();
  },

  async getStagePlot(stagePlotId) {
    const response = await apiClient(`/stage-plots/${stagePlotId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch stage plot");
    }

    return await response.json();
  },

  async getBandStagePlots(bandId) {
    const response = await apiClient(`/stage-plots/band/${bandId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch stage plots");
    }

    return await response.json();
  },

  async updateStagePlot(stagePlotId, stagePlotData) {
    const response = await apiClient(`/stage-plots/${stagePlotId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stagePlotData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update stage plot");
    }

    return await response.json();
  },

  async deleteStagePlot(stagePlotId) {
    const response = await apiClient(`/stage-plots/${stagePlotId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
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
