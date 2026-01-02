import React, { useState, useEffect, useRef } from "react";
import { rehearsalService } from "../../services/rehearsalService";
import { getImageUrl } from "../../utils/imageUtils";
import SetlistSelectModal from "./SetlistSelectModal";
import SetlistViewModal from "./SetlistViewModal";
import "./RehearsalEditModal.css";

// Trash can icon component
const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
      stroke="#e74c3c"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RehearsalEditModal = ({ bandId, instanceId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [instance, setInstance] = useState(null);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newAttachments, setNewAttachments] = useState([]);
  const [showSetlistSelectModal, setShowSetlistSelectModal] = useState(false);
  const [viewingSetlistId, setViewingSetlistId] = useState(null);
  const [showAttachDropdown, setShowAttachDropdown] = useState(false);
  const attachDropdownRef = useRef(null);
  
  // Form state
  const [instanceDate, setInstanceDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchInstance = async () => {
      if (!instanceId) return;
      
      try {
        setLoading(true);
        setError(null);
        const data = await rehearsalService.getRehearsalInstance(bandId, instanceId);
        setInstance(data);
        
        // Set form values from instance
        // Parse the datetime and convert to local timezone
        const instanceDateObj = new Date(data.instance_date);
        
        // Extract date in local timezone (not UTC)
        const year = instanceDateObj.getFullYear();
        const month = String(instanceDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(instanceDateObj.getDate()).padStart(2, '0');
        setInstanceDate(`${year}-${month}-${day}`);
        
        // Use start_time from rehearsal if available (avoids timezone issues)
        // This is the original time set during scheduling, not affected by timezone conversion
        if (data.start_time) {
          setStartTime(data.start_time);
        } else {
          // Fallback: extract time from instance_date in local timezone
          const hours = String(instanceDateObj.getHours()).padStart(2, '0');
          const minutes = String(instanceDateObj.getMinutes()).padStart(2, '0');
          setStartTime(`${hours}:${minutes}`);
        }
        
        setLocation(data.location);
        setDurationMinutes(data.duration_minutes);
        setNotes(data.notes || "");
        
        // Get instance-specific attachments (from API response)
        if (data.attachments) {
          setExistingAttachments(data.attachments);
        }
      } catch (err) {
        setError(err.message || "Failed to load rehearsal instance");
      } finally {
        setLoading(false);
      }
    };

    fetchInstance();
  }, [bandId, instanceId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachDropdownRef.current && !attachDropdownRef.current.contains(event.target)) {
        setShowAttachDropdown(false);
      }
    };

    if (showAttachDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachDropdown]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      // Store files in state to upload after saving
      setNewAttachments((prev) => [...prev, ...files]);
    } catch (err) {
      setError(err.message || "Failed to prepare files for upload");
    } finally {
      setUploading(false);
    }
  };

  const removeNewAttachment = (index) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!instanceId) return;
    
    if (!window.confirm("Are you sure you want to delete this attachment?")) {
      return;
    }

    try {
      await rehearsalService.deleteInstanceAttachment(bandId, instanceId, attachmentId);
      // Remove from existing attachments
      setExistingAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
    } catch (err) {
      setError(err.message || "Failed to delete attachment");
    }
  };

  const handleAttachSetlist = async (setlistId) => {
    if (!instanceId) return;

    setUploading(true);
    setError(null);

    try {
      const attachment = await rehearsalService.attachSetlistToInstance(
        bandId,
        instanceId,
        setlistId
      );
      // Add to existing attachments list
      setExistingAttachments((prev) => [...prev, attachment]);
    } catch (err) {
      setError(err.message || "Failed to attach setlist");
    } finally {
      setUploading(false);
    }
  };

  const handleViewSetlist = (setlistId) => {
    setViewingSetlistId(setlistId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Combine date and time for instance_date
      // Create date in local timezone, then convert to ISO string
      // This ensures the time is preserved correctly
      const [year, month, day] = instanceDate.split('-').map(Number);
      const [hours, minutes] = startTime.split(':').map(Number);
      
      // Create date in local timezone
      const localDateTime = new Date(year, month - 1, day, hours, minutes);
      
      // Convert to ISO string (this will include timezone offset)
      const updateData = {
        instance_date: localDateTime.toISOString(),
        location: location,
        duration_minutes: durationMinutes,
        notes: notes || null,
      };

      await rehearsalService.updateRehearsalInstance(bandId, instanceId, updateData);

      // Upload new attachments if any (to the specific instance)
      if (newAttachments.length > 0) {
        for (const file of newAttachments) {
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

          const uploadedAttachment = await rehearsalService.uploadInstanceAttachment(
            bandId,
            instanceId,
            file,
            fileType
          );
          
          // Add to existing attachments list
          setExistingAttachments((prev) => [...prev, uploadedAttachment]);
        }
        // Clear new attachments after upload
        setNewAttachments([]);
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update rehearsal instance");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content rehearsal-edit-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
          <div className="modal-loading">Loading rehearsal...</div>
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content rehearsal-edit-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
          <div className="modal-error">Rehearsal instance not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content rehearsal-edit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <h2>Edit Rehearsal</h2>
        {instance.is_recurring && (
          <p className="recurring-note">
            This is a recurring rehearsal. Your changes will only affect this specific date.
          </p>
        )}

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              Date <span className="required">*</span>
            </label>
            <input
              type="date"
              value={instanceDate}
              onChange={(e) => setInstanceDate(e.target.value)}
              required
            />
          </div>

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
            <label>Attachments</label>
            
            {/* Existing attachments */}
            {existingAttachments.length > 0 && (
              <div className="existing-attachments">
                <label className="attachments-sub-label">Current attachments:</label>
                {existingAttachments.map((attachment) => (
                  <div key={attachment.id} className="attachment-item existing">
                    {attachment.setlist_id ? (
                      <>
                        <span 
                          className="attachment-link clickable-setlist"
                          onClick={() => handleViewSetlist(attachment.setlist_id)}
                          title="View setlist"
                        >
                          📋 {attachment.setlist_name || `Setlist (ID: ${attachment.setlist_id})`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="remove-attachment"
                          title="Delete attachment"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    ) : attachment.file_path ? (
                      <>
                        <a
                          href={getImageUrl(attachment.file_path, process.env.REACT_APP_API_URL || "http://localhost:8000")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-link"
                        >
                          {attachment.file_name || "File"}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="remove-attachment"
                          title="Delete attachment"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="attachment-link">
                          {attachment.file_name || "Attachment"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="remove-attachment"
                          title="Delete attachment"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Attachment options */}
            <div className="attachment-options">
              <div className="attach-dropdown-container" ref={attachDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowAttachDropdown(!showAttachDropdown)}
                  disabled={uploading}
                  className="attach-dropdown-button"
                >
                  <span className="attach-icon">📎</span>
                  <span>Attach</span>
                  <span className="dropdown-arrow">{showAttachDropdown ? '▲' : '▼'}</span>
                </button>
                {showAttachDropdown && (
                  <div className="attach-dropdown-menu">
                    <label htmlFor="file-upload-input" className="attach-dropdown-item">
                      <input
                        id="file-upload-input"
                        type="file"
                        multiple
                        onChange={(e) => {
                          handleFileUpload(e);
                          setShowAttachDropdown(false);
                        }}
                        disabled={uploading}
                        className="file-input"
                      />
                      <span>File</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSetlistSelectModal(true);
                        setShowAttachDropdown(false);
                      }}
                      disabled={uploading}
                      className="attach-dropdown-item"
                    >
                      <span>Setlist</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <small className="form-hint">
              Upload files or attach a setlist from your setlist builder.
            </small>
            {newAttachments.length > 0 && (
              <div className="attachments-list">
                {newAttachments.map((file, index) => (
                  <div key={index} className="attachment-item new">
                    <span>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeNewAttachment(index)}
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
              {saving || uploading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>

        {showSetlistSelectModal && (
          <SetlistSelectModal
            bandId={bandId}
            onSelect={handleAttachSetlist}
            onClose={() => setShowSetlistSelectModal(false)}
          />
        )}

        {viewingSetlistId && (
          <SetlistViewModal
            setlistId={viewingSetlistId}
            onClose={() => setViewingSetlistId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default RehearsalEditModal;

