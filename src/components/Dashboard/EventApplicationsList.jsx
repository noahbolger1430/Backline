import React, { useState, useEffect } from "react";
import { eventApplicationService } from "../../services/eventApplicationService";
import { bandService } from "../../services/bandService";
import "./EventApplicationsList.css";

const EventApplicationsList = ({ eventId, isOpenForApplications, onApplicationReviewed }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewingApp, setReviewingApp] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState("accepted");
  const [actionLoading, setActionLoading] = useState(false);
  const [bandDetails, setBandDetails] = useState({});
  const [loadingBandDetails, setLoadingBandDetails] = useState({});

  useEffect(() => {
    if (eventId) {
      fetchApplications();
    }
  }, [eventId]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await eventApplicationService.listEventApplications(eventId);
      setApplications(response.applications || []);
    } catch (err) {
      console.error("Error fetching applications:", err);
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (applicationId) => {
    if (!reviewNote.trim() && reviewStatus === "rejected") {
      alert("Please provide a note when rejecting an application");
      return;
    }

    try {
      setActionLoading(true);
      const reviewData = {
        status: reviewStatus,
        response_note: reviewNote.trim() || null,
      };

      await eventApplicationService.reviewApplication(applicationId, reviewData);
      
      // Refresh applications list
      await fetchApplications();
      
      // Notify parent component if callback provided (to refresh event data)
      if (onApplicationReviewed) {
        onApplicationReviewed();
      }
      
      // Reset review form
      setReviewingApp(null);
      setReviewNote("");
      setReviewStatus("accepted");
    } catch (err) {
      console.error("Error reviewing application:", err);
      alert(err.message || "Failed to review application");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "application-status-pending";
      case "accepted":
        return "application-status-accepted";
      case "rejected":
        return "application-status-rejected";
      case "reviewed":
        return "application-status-reviewed";
      case "withdrawn":
        return "application-status-withdrawn";
      default:
        return "application-status-default";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Spotify URL conversion functions (from EventEditForm)
  const isSpotifyIframe = (url) => {
    if (!url) return false;
    return url.includes('<iframe') || url.includes('embed.spotify.com') || url.includes('open.spotify.com/embed');
  };

  const getSpotifyEmbed = (spotifyUrl) => {
    if (!spotifyUrl) return null;
    
    // If it's already an iframe tag, extract the src
    if (spotifyUrl.includes('<iframe')) {
      // Try to extract src from iframe tag
      const srcMatch = spotifyUrl.match(/src=["']([^"']+)["']/);
      if (srcMatch) {
        return srcMatch[1];
      }
      // Try full iframe match
      const fullMatch = spotifyUrl.match(/<iframe[^>]+src=["']([^"']+)["']/);
      if (fullMatch) {
        return fullMatch[1];
      }
    }
    
    // If it's already an embed URL, use it directly
    if (spotifyUrl.includes('embed.spotify.com') || spotifyUrl.includes('open.spotify.com/embed')) {
      // If it starts with /embed, prepend https://open.spotify.com
      if (spotifyUrl.startsWith('/embed')) {
        return `https://open.spotify.com${spotifyUrl}`;
      }
      return spotifyUrl.startsWith('http') ? spotifyUrl : `https://${spotifyUrl}`;
    }
    
    // If it's a regular Spotify URL, convert to embed format
    if (spotifyUrl.includes('open.spotify.com')) {
      // Replace /artist/, /album/, /track/, etc. with /embed/artist/, /embed/album/, etc.
      return spotifyUrl.replace(/open\.spotify\.com\/([^\/]+)/, 'open.spotify.com/embed/$1');
    }
    
    // If it's a spotify: URI, we can't easily convert to embed
    // Return null so it shows as a link instead
    if (spotifyUrl.startsWith('spotify:')) {
      return null;
    }
    
    return null;
  };

  const fetchBandDetails = async (bandId) => {
    if (!bandId || bandDetails[bandId]) return; // Already loaded
    
    try {
      setLoadingBandDetails(prev => ({ ...prev, [bandId]: true }));
      const details = await bandService.getBandDetails(bandId);
      setBandDetails(prev => ({ ...prev, [bandId]: details }));
    } catch (err) {
      console.error("Error fetching band details:", err);
      setBandDetails(prev => ({ ...prev, [bandId]: null }));
    } finally {
      setLoadingBandDetails(prev => ({ ...prev, [bandId]: false }));
    }
  };

  const handleStartReview = (application) => {
    setReviewingApp(application.id);
    // Fetch band details when starting review
    if (application.band_id) {
      fetchBandDetails(application.band_id);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
    return `${baseUrl}/${imagePath}`;
  };

  if (loading) {
    return (
      <div className="applications-loading">Loading applications...</div>
    );
  }

  if (error) {
    return (
      <div className="applications-error">Error: {error}</div>
    );
  }

  const pendingApplications = applications.filter((app) => app.status === "pending");
  const otherApplications = applications.filter((app) => app.status !== "pending");

  return (
    <div className="event-applications-list">
      {!isOpenForApplications && applications.length === 0 && (
        <div className="applications-empty">
          This event is not currently accepting applications.
        </div>
      )}

      {isOpenForApplications && applications.length === 0 && (
        <div className="applications-empty">
          No applications yet. Bands can apply to this event.
        </div>
      )}

      {pendingApplications.length > 0 && (
        <div className="applications-section">
          <h4 className="applications-section-title">Pending Applications ({pendingApplications.length})</h4>
          {pendingApplications.map((application) => (
            <div key={application.id} className="application-card">
              <div className="application-header">
                <div className="application-band-info">
                  <span className="application-band-name">{application.band_name}</span>
                  <span className={`application-status ${getStatusBadgeClass(application.status)}`}>
                    {application.status}
                  </span>
                </div>
                <span className="application-date">
                  Applied: {formatDate(application.applied_at)}
                </span>
              </div>

              {application.message && (
                <div className="application-message">
                  <strong>Message:</strong>
                  <p>{application.message}</p>
                </div>
              )}

              {reviewingApp === application.id ? (
                <div className="application-review-form">
                  {/* Band Details Section */}
                  {application.band_id && (
                    <div className="band-details-section">
                      {loadingBandDetails[application.band_id] ? (
                        <div className="band-details-loading">Loading band information...</div>
                      ) : bandDetails[application.band_id] ? (
                        <>
                          {/* Band Photo */}
                          {bandDetails[application.band_id].image_path && (
                            <div className="band-photo-container">
                              <img 
                                src={getImageUrl(bandDetails[application.band_id].image_path)} 
                                alt={application.band_name}
                                className="band-photo"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}

                          {/* Band Genre */}
                          {bandDetails[application.band_id].genre && (
                            <div className="band-info-item">
                              <span className="band-info-label">Genre:</span>
                              <span className="band-info-value">{bandDetails[application.band_id].genre}</span>
                            </div>
                          )}

                          {/* Band Description */}
                          {bandDetails[application.band_id].description && (
                            <div className="band-info-item">
                              <span className="band-info-label">Description:</span>
                              <p className="band-info-value band-description">{bandDetails[application.band_id].description}</p>
                            </div>
                          )}

                          {/* Spotify Section - At the top */}
                          {bandDetails[application.band_id].spotify_url && (
                            <div className="band-spotify-section">
                              {isSpotifyIframe(bandDetails[application.band_id].spotify_url) && getSpotifyEmbed(bandDetails[application.band_id].spotify_url) ? (
                                <div className="spotify-embed-container">
                                  <iframe
                                    src={getSpotifyEmbed(bandDetails[application.band_id].spotify_url)}
                                    width="100%"
                                    height="352"
                                    frameBorder="0"
                                    allowtransparency="true"
                                    allow="encrypted-media"
                                    title="Spotify Embed"
                                    style={{ borderRadius: '12px' }}
                                  />
                                </div>
                              ) : (
                                <a 
                                  href={bandDetails[application.band_id].spotify_url.startsWith('http') ? bandDetails[application.band_id].spotify_url : `https://${bandDetails[application.band_id].spotify_url}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="band-spotify-link"
                                >
                                  <span className="social-icon">🎵</span>
                                  <span>Listen on Spotify</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Social Media Links */}
                          {(bandDetails[application.band_id].instagram_url || 
                            bandDetails[application.band_id].facebook_url || 
                            bandDetails[application.band_id].website_url) && (
                            <div className="band-social-links">
                              {bandDetails[application.band_id].instagram_url && (
                                <a 
                                  href={bandDetails[application.band_id].instagram_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="band-social-link-item"
                                >
                                  <span className="social-icon">📷</span>
                                  <span>Instagram</span>
                                </a>
                              )}
                              {bandDetails[application.band_id].facebook_url && (
                                <a 
                                  href={bandDetails[application.band_id].facebook_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="band-social-link-item"
                                >
                                  <span className="social-icon">👥</span>
                                  <span>Facebook</span>
                                </a>
                              )}
                              {bandDetails[application.band_id].website_url && (
                                <a 
                                  href={bandDetails[application.band_id].website_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="band-social-link-item"
                                >
                                  <span className="social-icon">🌐</span>
                                  <span>Website</span>
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}

                  <div className="review-form-group">
                    <label>Decision:</label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value)}
                      className="review-status-select"
                    >
                      <option value="accepted">Accept</option>
                      <option value="rejected">Reject</option>
                      <option value="reviewed">Mark as Reviewed</option>
                    </select>
                  </div>
                  <div className="review-form-group">
                    <label>Response Note (optional):</label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Add a note for the band..."
                      rows={3}
                      className="review-note-textarea"
                    />
                  </div>
                  <div className="review-form-actions">
                    <button
                      onClick={() => {
                        setReviewingApp(null);
                        setReviewNote("");
                        setReviewStatus("accepted");
                      }}
                      className="btn-cancel-review"
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReview(application.id)}
                      className={`btn-submit-review btn-${reviewStatus}`}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Processing..." : 
                        reviewStatus === "accepted" ? "Accept Application" :
                        reviewStatus === "rejected" ? "Reject Application" :
                        "Mark as Reviewed"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="application-actions">
                  <button
                    onClick={() => handleStartReview(application)}
                    className="btn-review-application"
                  >
                    Review Application
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {otherApplications.length > 0 && (
        <div className="applications-section">
          <h4 className="applications-section-title">Other Applications ({otherApplications.length})</h4>
          {otherApplications.map((application) => (
            <div key={application.id} className="application-card">
              <div className="application-header">
                <div className="application-band-info">
                  <span className="application-band-name">{application.band_name}</span>
                  <span className={`application-status ${getStatusBadgeClass(application.status)}`}>
                    {application.status}
                  </span>
                </div>
                <span className="application-date">
                  Applied: {formatDate(application.applied_at)}
                </span>
              </div>

              {application.message && (
                <div className="application-message">
                  <strong>Message:</strong>
                  <p>{application.message}</p>
                </div>
              )}

              {application.response_note && (
                <div className="application-response">
                  <strong>Your Response:</strong>
                  <p>{application.response_note}</p>
                </div>
              )}

              {application.reviewed_at && (
                <div className="application-reviewed-info">
                  Reviewed on {formatDate(application.reviewed_at)}
                  {application.reviewed_by_name && ` by ${application.reviewed_by_name}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventApplicationsList;

