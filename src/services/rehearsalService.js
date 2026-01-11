import { apiClient } from '../utils/apiClient';

export const rehearsalService = {
  async createRehearsal(bandId, rehearsalData) {
    const response = await apiClient(`/bands/${bandId}/rehearsals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rehearsalData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create rehearsal");
    }

    return await response.json();
  },

  async getBandRehearsals(bandId, startDate = null, endDate = null) {
    let url = `/bands/${bandId}/rehearsals`;
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await apiClient(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch rehearsals");
    }

    return await response.json();
  },

  async getRehearsalsForCalendar(bandId, startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    const url = `/bands/${bandId}/rehearsals/calendar?${params.toString()}`;

    const response = await apiClient(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch rehearsals for calendar");
    }

    return await response.json();
  },

  async getRehearsal(bandId, rehearsalId) {
    const response = await apiClient(
      `/bands/${bandId}/rehearsals/${rehearsalId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch rehearsal");
    }

    return await response.json();
  },

  async updateRehearsal(bandId, rehearsalId, rehearsalData) {
    const response = await apiClient(
      `/bands/${bandId}/rehearsals/${rehearsalId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rehearsalData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update rehearsal");
    }

    return await response.json();
  },

  async deleteRehearsal(bandId, rehearsalId) {
    const response = await apiClient(
      `/bands/${bandId}/rehearsals/${rehearsalId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete rehearsal");
    }
  },

  async uploadAttachment(bandId, rehearsalId, file, fileType = null) {
    const formData = new FormData();
    formData.append("file", file);
    if (fileType) {
      formData.append("file_type", fileType);
    }

    const response = await apiClient(
      `/bands/${bandId}/rehearsals/${rehearsalId}/attachments`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload attachment");
    }

    return await response.json();
  },

  async deleteAttachment(bandId, rehearsalId, attachmentId) {
    const response = await apiClient(
      `/bands/${bandId}/rehearsals/${rehearsalId}/attachments/${attachmentId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete attachment");
    }
  },

  async getRehearsalInstance(bandId, instanceId) {
    const response = await apiClient(
      `/bands/${bandId}/rehearsals/instances/${instanceId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch rehearsal instance");
    }

    return await response.json();
  },

  async updateRehearsalInstance(bandId, instanceId, instanceData) {
    const response = await apiClient(
      `/bands/${bandId}/rehearsals/instances/${instanceId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(instanceData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update rehearsal instance");
    }

    return await response.json();
  },

  async uploadInstanceAttachment(bandId, instanceId, file, fileType = null) {
    const formData = new FormData();
    formData.append("file", file);
    if (fileType) {
      formData.append("file_type", fileType);
    }

    const response = await apiClient(
      `/bands/${bandId}/rehearsals/instances/${instanceId}/attachments`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload attachment");
    }

    return await response.json();
  },

  async attachSetlistToInstance(bandId, instanceId, setlistId) {
    const formData = new FormData();
    formData.append("setlist_id", setlistId.toString());
    formData.append("file_type", "setlist");

    const response = await apiClient(
      `/bands/${bandId}/rehearsals/instances/${instanceId}/attachments`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to attach setlist");
    }

    return await response.json();
  },

  async deleteInstanceAttachment(bandId, instanceId, attachmentId) {
    const response = await apiClient(
      `/bands/${bandId}/rehearsals/instances/${instanceId}/attachments/${attachmentId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete attachment");
    }
  },
};
