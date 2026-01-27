import React, { useState } from "react";
import { rehearsalService } from "../../services/rehearsalService";
import "./RehearsalModal.css";

const getApiUrl = () => {
  let url = process.env.REACT_APP_API_URL || "http://localhost:8000";
  url = url.replace(/\/$/, "");
  return url.includes("/api/v1") ? url : `${url}/api/v1`;
};
const API_BASE_URL = getApiUrl();

const RehearsalModal = ({ bandId, date = null, onClose, onSuccess }) => {
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("weekly");
  const [recurrenceStartDate, setRecurrenceStartDate] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [rehearsalDate, setRehearsalDate] = useState(
    date ? date.toISOString().split("T")[0] : ""
  );
  const [startTime, setStartTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      // We'll upload files after rehearsal is created
      // For now, just store them in state
      setAttachments((prev) => [...prev, ...files]);
    } catch (err) {
      setError(err.message || "Failed to prepare files for upload");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Prepare rehearsal data
      const rehearsalData = {
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        recurrence_start_date: isRecurring
          ? recurrenceStartDate
            ? new Date(recurrenceStartDate + "T" + startTime).toISOString()
            : null
          : null,
        recurrence_end_date: isRecurring && recurrenceEndDate
          ? new Date(recurrenceEndDate + "T23:59:59").toISOString()
          : null,
        rehearsal_date: !isRecurring && rehearsalDate
          ? new Date(rehearsalDate + "T" + startTime).toISOString()
          : null,
        start_time: startTime,
        location: location,
        duration_minutes: durationMinutes,
        notes: notes || null,
      };

      // Create rehearsal
      const rehearsal = await rehearsalService.createRehearsal(bandId, rehearsalData);

      // Upload attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          // Determine file type from extension
          const extension = file.name.split(".").pop().toLowerCase();
          let fileType = "other";
          if (["pdf", "doc", "docx", "txt"].includes(extension)) {
            fileType = "setlist";
          } else if (["mp4", "avi", "mov", "mkv"].includes(extension)) {
            fileType = "video";
          } else if (["mp3", "wav", "m4a", "flac"].includes(extension)) {
            fileType = "demo";
          }

          await rehearsalService.uploadAttachment(
            bandId,
            rehearsal.id,
            file,
            fileType
          );
        }
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create rehearsal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content rehearsal-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <h2>Schedule Rehearsal</h2>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <span>Recurring rehearsal</span>
            </label>
          </div>

          {isRecurring ? (
            <>
              <div className="form-group">
                <label>
                  Frequency <span className="required">*</span>
                </label>
                <select
                  value={recurrenceFrequency}
                  onChange={(e) => setRecurrenceFrequency(e.target.value)}
                  required
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Start Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  value={recurrenceStartDate}
                  onChange={(e) => setRecurrenceStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Date (optional)</label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>
                Rehearsal Date <span className="required">*</span>
              </label>
              <input
                type="date"
                value={rehearsalDate}
                onChange={(e) => setRehearsalDate(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>
              Start Time <span className="required">*</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Location <span className="required">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Studio A, 123 Main St"
              required
            />
          </div>

          <div className="form-group">
            <label>
              Duration (minutes) <span className="required">*</span>
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
              min="1"
              max="1440"
              required
            />
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Focus on new songs, Bring extra cables..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Attachments (optional)</label>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <small className="form-hint">
              Upload setlists, videos, demo tapes, etc.
            </small>
            {attachments.length > 0 && (
              <div className="attachments-list">
                {attachments.map((file, index) => (
                  <div key={index} className="attachment-item">
                    <span>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="remove-attachment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="modal-button cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button confirm-button"
              disabled={saving || uploading}
            >
              {saving ? "Saving..." : "Schedule Rehearsal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RehearsalModal;

