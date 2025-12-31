import React, { useState, useEffect } from "react";
import { eventApplicationService } from "../../services/eventApplicationService";
import { bandService } from "../../services/bandService";
import { venueRecommendationService } from "../../services/venueRecommendationService";
import "./EventApplicationsList.css";

const EventApplicationsList = ({ 
  eventId, 
  venueId, 
  isOpenForApplications, 
  onApplicationReviewed,
  onToggleApplications,
  applicationActionLoading = false,
}) => {
  const [applications, setApplications] = useState([]);
  const [scoredApplicants, setScoredApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewingApp, setReviewingApp] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState("accepted");
  const [actionLoading, setActionLoading] = useState(false);
  const [bandDetails, setBandDetails] = useState({});
  const [loadingBandDetails, setLoadingBandDetails] = useState({});
  const [useScoring, setUseScoring] = useState(true);

  useEffect(() => {
    if (eventId) {
      if (venueId && useScoring) {
        fetchScoredApplicants();
      } else {
        fetchApplications();
      }
    }
  }, [eventId, venueId, useScoring]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await eventApplicationService.listEventApplications(eventId);
      setApplications(response.applications || []);
      setScoredApplicants([]);
    } catch (err) {
      console.error("Error fetching applications:", err);
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const fetchScoredApplicants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await venueRecommendationService.getScoredApplicants(venueId, eventId);
      setScoredApplicants(response.applicants || []);
      setApplications([]);
    } catch (err) {
      console.warn("Could not fetch scored applicants, falling back to regular list:", err);
      // Fall back to regular applications
      fetchApplications();
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
      if (venueId && useScoring) {
        await fetchScoredApplicants();
      } else {
        await fetchApplications();
      }
      
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

  const handleStartReview = (application, bandId) => {
    setReviewingApp(application.application_id || application.id);
    // Fetch band details when starting review
    const bId = bandId || application.band_id;
    if (bId) {
      fetchBandDetails(bId);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
    return `${baseUrl}/${imagePath}`;
  };

  // Get icon for recommendation reason
  const getReasonIcon = (type) => {
    switch (type) {
      case "event_genre_match":
        return "🎸";
      case "event_genre_partial":
        return "🎵";
      case "venue_genre_match":
        return "🎶";
      case "venue_genre_partial":
        return "🎼";
      case "previous_success":
        return "⭐";
      case "gig_activity_high":
        return "🔥";
      case "gig_activity_medium":
        return "📈";
      case "gig_activity_low":
        return "📊";
      case "profile_complete":
        return "✓";
      case "profile_partial":
        return "📋";
      case "location_local":
        return "📍";
      case "location_state":
        return "🗺️";
      case "location_nearby":
        return "🚗";
      default:
        return "✨";
    }
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

  // Use scored applicants if available, otherwise use regular applications
  const hasScoring = scoredApplicants.length > 0;
  const allItems = hasScoring ? scoredApplicants : applications;
  
  const pendingItems = allItems.filter((item) => 
    (hasScoring ? item.status : item.status) === "pending"
  );
  const otherItems = allItems.filter((item) => 
    (hasScoring ? item.status : item.status) !== "pending"
  );

  // Render a single application card (works for both scored and regular)
  const renderApplicationCard = (item, isScored = false) => {
    const applicationId = isScored ? item.application_id : item.id;
    const bandId = isScored ? item.band_id : item.band_id;
    const bandName = isScored ? item.band_name : item.band_name;
    const status = item.status;
    const message = item.message;
    const appliedAt = item.applied_at;
    const responseNote = item.response_note;
    const reviewedAt = item.reviewed_at;
    const reviewedByName = isScored ? item.reviewed_by_name : item.reviewed_by_name;
    
    // For scored items, we get band info directly
    const getBandInfo = () => {
      if (isScored) {
        return {
          genre: item.band_genre,
          location: item.band_location,
          description: item.band_description,
          image_path: item.band_image_path,
          spotify_url: item.band_spotify_url,
          instagram_url: item.band_instagram_url,
          facebook_url: item.band_facebook_url,
          website_url: item.band_website_url,
        };
      }
      return bandDetails[bandId] || null;
    };

    const bandInfo = getBandInfo();
    const isReviewing = reviewingApp === applicationId;

    return (
      <div 
        key={applicationId} 
        className={`application-card ${isScored && item.is_top_match ? 'top-match' : ''}`}
      >
        <div className="application-header">
          <div className="application-band-info">
            <span className="application-band-name">{bandName}</span>
            {isScored && item.is_top_match && (
              <span className="best-match-badge">⭐ Best Match</span>
            )}
            <span className={`application-status ${getStatusBadgeClass(status)}`}>
              {status}
            </span>
          </div>
          <span className="application-date">
            Applied: {formatDate(appliedAt)}
          </span>
        </div>

        {/* Recommendation Score and Reasons */}
        {isScored && item.recommendation_score !== undefined && (
          <div className="application-recommendation-section">
            <div className="recommendation-score">
              <span className="score-label">Match Score:</span>
              <span className="score-value">{item.recommendation_score.toFixed(0)}</span>
            </div>
            {item.recommendation_reasons && item.recommendation_reasons.length > 0 && (
              <div className="recommendation-reasons">
                {item.recommendation_reasons.map((reason, idx) => (
                  <span 
                    key={idx} 
                    className={`reason-tag ${reason.type}`}
                    title={`+${reason.score.toFixed(0)} points`}
                  >
                    {getReasonIcon(reason.type)} {reason.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {message && (
          <div className="application-message">
            <strong>Message:</strong>
            <p>{message}</p>
          </div>
        )}

        {isReviewing ? (
          <div className="application-review-form">
            {/* Band Details Section */}
            {bandId && (
              <div className="band-details-section">
                {!isScored && loadingBandDetails[bandId] ? (
                  <div className="band-details-loading">Loading band information...</div>
                ) : bandInfo ? (
                  <>
                    {/* Band Photo */}
                    {bandInfo.image_path && (
                      <div className="band-photo-container">
                        <img 
                          src={getImageUrl(bandInfo.image_path)} 
                          alt={bandName}
                          className="band-photo"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Band Genre */}
                    {bandInfo.genre && (
                      <div className="band-info-item">
                        <span className="band-info-label">Genre:</span>
                        <span className="band-info-value">{bandInfo.genre}</span>
                      </div>
                    )}

                    {/* Band Location */}
                    {bandInfo.location && (
                      <div className="band-info-item">
                        <span className="band-info-label">Location:</span>
                        <span className="band-info-value">{bandInfo.location}</span>
                      </div>
                    )}

                    {/* Band Description */}
                    {bandInfo.description && (
                      <div className="band-info-item">
                        <span className="band-info-label">Description:</span>
                        <p className="band-info-value band-description">{bandInfo.description}</p>
                      </div>
                    )}

                    {/* Spotify Section */}
                    {bandInfo.spotify_url && (
                      <div className="band-spotify-section">
                        {isSpotifyIframe(bandInfo.spotify_url) && getSpotifyEmbed(bandInfo.spotify_url) ? (
                          <div className="spotify-embed-container">
                            <iframe
                              src={getSpotifyEmbed(bandInfo.spotify_url)}
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
                            href={bandInfo.spotify_url.startsWith('http') ? bandInfo.spotify_url : `https://${bandInfo.spotify_url}`} 
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
                    {(bandInfo.instagram_url || 
                      bandInfo.facebook_url || 
                      bandInfo.website_url) && (
                      <div className="band-social-links">
                        {bandInfo.instagram_url && (
                          <a 
                            href={bandInfo.instagram_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="band-social-link-item"
                          >
                            <span className="social-icon">📷</span>
                            <span>Instagram</span>
                          </a>
                        )}
                        {bandInfo.facebook_url && (
                          <a 
                            href={bandInfo.facebook_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="band-social-link-item"
                          >
                            <span className="social-icon">👥</span>
                            <span>Facebook</span>
                          </a>
                        )}
                        {bandInfo.website_url && (
                          <a 
                            href={bandInfo.website_url} 
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
                onClick={() => handleReview(applicationId)}
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
        ) : status === "pending" ? (
          <div className="application-actions">
            <button
              onClick={() => handleStartReview(item, bandId)}
              className="btn-review-application"
            >
              Review Application
            </button>
          </div>
        ) : (
          <>
            {responseNote && (
              <div className="application-response">
                <strong>Your Response:</strong>
                <p>{responseNote}</p>
              </div>
            )}

            {reviewedAt && (
              <div className="application-reviewed-info">
                Reviewed on {formatDate(reviewedAt)}
                {reviewedByName && ` by ${reviewedByName}`}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const totalCount = allItems.length;

  return (
    <div className="event-applications-list">
      {/* Main section header with title, status, and toggle */}
      <div className="applications-main-header">
        <div className="applications-title-row">
          <h3 className="applications-main-title">Band Applications ({totalCount})</h3>
          {hasScoring && (
            <span className="sorted-by-match">Sorted by match score</span>
          )}
        </div>
        <div className="applications-controls-row">
          <div className="application-status-display">
            <span className="application-status-label">Application Status:</span>
            <span className={`application-status-value ${isOpenForApplications ? 'status-open' : 'status-closed'}`}>
              {isOpenForApplications ? "Open" : "Closed"}
            </span>
          </div>
          {onToggleApplications && (
            <div className="application-button-container">
              {isOpenForApplications ? (
                <button
                  type="button"
                  className="btn-close-applications"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleApplications(false);
                  }}
                  disabled={applicationActionLoading}
                >
                  {applicationActionLoading ? "Closing..." : "Close Applications"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-open-applications"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleApplications(true);
                  }}
                  disabled={applicationActionLoading}
                >
                  {applicationActionLoading ? "Opening..." : "Open for Applications"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!isOpenForApplications && allItems.length === 0 && (
        <div className="applications-empty">
          This event is not currently accepting applications.
        </div>
      )}

      {isOpenForApplications && allItems.length === 0 && (
        <div className="applications-empty">
          No applications yet. Bands can apply to this event.
        </div>
      )}

      {/* All applications (pending first, then others) */}
      {allItems.length > 0 && (
        <div className="applications-section">
          {pendingItems.map((item) => renderApplicationCard(item, hasScoring))}
          {otherItems.map((item) => renderApplicationCard(item, hasScoring))}
        </div>
      )}
    </div>
  );
};

export default EventApplicationsList;
