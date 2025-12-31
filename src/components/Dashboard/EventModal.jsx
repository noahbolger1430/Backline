import React, { useEffect, useState } from "react";
import { eventService } from "../../services/eventService";
import { equipmentService } from "../../services/equipmentService";
import EventApplicationsList from "./EventApplicationsList";
import ClaimEquipmentModal from "./ClaimEquipmentModal";
import "./EventModal.css";

const EventModal = ({ event, onClose, bandId = null }) => {
  const [fullEvent, setFullEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backlineData, setBacklineData] = useState(null);
  const [userHasCategory, setUserHasCategory] = useState({}); // { category: boolean }
  const [loadingBackline, setLoadingBackline] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimingCategory, setClaimingCategory] = useState(null); // category being claimed

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!event?.id) return;
      
      try {
        setLoading(true);
        // Fetch full event details including bands
        const eventDetails = await eventService.getEvent(event.id);
        setFullEvent(eventDetails);
      } catch (err) {
        console.error("Error fetching event details:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [event?.id]);

  // Fetch backline equipment when event is loaded (for both band and venue views)
  useEffect(() => {
    const fetchBackline = async () => {
      if (!fullEvent?.id || !fullEvent?.bands || fullEvent.bands.length === 0) {
        return;
      }

      try {
        setLoadingBackline(true);
        const backline = await equipmentService.getEventBackline(fullEvent.id);
        setBacklineData(backline);

        // If user is viewing as a band member, check which categories they have
        if (bandId) {
          const categories = ["guitar_amp", "bass_amp", "keyboard_amp", "drum_kit", "keyboard"];
          const categoryChecks = {};
          
          for (const category of categories) {
            try {
              const check = await equipmentService.checkUserHasCategory(bandId, category);
              categoryChecks[category] = check.has_category;
            } catch (err) {
              console.error(`Error checking category ${category}:`, err);
              categoryChecks[category] = false;
            }
          }
          
          setUserHasCategory(categoryChecks);
        }
      } catch (err) {
        console.error("Error fetching backline:", err);
        // Don't set error state - backline is optional
      } finally {
        setLoadingBackline(false);
      }
    };

    fetchBackline();
  }, [fullEvent?.id, bandId]);

  /**
   * Refresh backline data after claiming/unclaiming
   */
  const refreshBackline = async () => {
    if (!fullEvent?.id) return;
    
    try {
      setLoadingBackline(true);
      const backline = await equipmentService.getEventBackline(fullEvent.id);
      setBacklineData(backline);
    } catch (err) {
      console.error("Error refreshing backline:", err);
    } finally {
      setLoadingBackline(false);
    }
  };

  /**
   * Handle claim button click
   */
  const handleClaimClick = (category) => {
    setClaimingCategory(category);
    setClaimModalOpen(true);
  };

  /**
   * Handle successful claim
   */
  const handleClaimSuccess = () => {
    refreshBackline();
  };

  /**
   * Handle unclaim
   */
  const handleUnclaim = async (equipmentId) => {
    if (!window.confirm("Are you sure you want to unclaim this equipment?")) {
      return;
    }

    try {
      await equipmentService.unclaimEquipmentForEvent(fullEvent.id, equipmentId);
      await refreshBackline();
    } catch (err) {
      console.error("Error unclaiming equipment:", err);
      alert(err.message || "Failed to unclaim equipment");
    }
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return null;
    // Handle time format "HH:MM:SS" or "HH:MM"
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'status-badge-confirmed';
      case 'pending':
        return 'status-badge-pending';
      case 'cancelled':
        return 'status-badge-cancelled';
      default:
        return 'status-badge-default';
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    // Assuming images are served from the backend at /images endpoint
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
    return `${baseUrl}/${imagePath}`;
  };

  if (!event) return null;

  return (
    <div className="event-modal-overlay" onClick={onClose}>
      <div className="event-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        {loading && <div className="modal-loading">Loading event details...</div>}
        
        {error && <div className="modal-error">Error loading event details: {error}</div>}

        {!loading && !error && fullEvent && (
          <>
            {/* Event Image */}
            {fullEvent.image_path && (
              <div className="modal-image-container">
                <img 
                  src={getImageUrl(fullEvent.image_path)} 
                  alt={fullEvent.name}
                  className="modal-event-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Event Title and Status */}
            <div className="modal-header">
              <h2 className="modal-title">{fullEvent.name}</h2>
              <span className={`status-badge ${getStatusBadgeClass(fullEvent.status)}`}>
                {fullEvent.status}
              </span>
            </div>

            {/* Event Date and Time */}
            <div className="modal-section">
              <h3 className="modal-section-title">Date & Time</h3>
              <div className="modal-datetime">
                <div className="modal-info-row">
                  <span className="modal-info-label">Date:</span>
                  <span className="modal-info-value">{formatDate(fullEvent.event_date)}</span>
                </div>
                {fullEvent.doors_time && (
                  <div className="modal-info-row">
                    <span className="modal-info-label">Doors:</span>
                    <span className="modal-info-value">{formatTime(fullEvent.doors_time)}</span>
                  </div>
                )}
                <div className="modal-info-row">
                  <span className="modal-info-label">Show Time:</span>
                  <span className="modal-info-value">{formatTime(fullEvent.show_time)}</span>
                </div>
              </div>
            </div>

            {/* Event Description */}
            {fullEvent.description && (
              <div className="modal-section">
                <h3 className="modal-section-title">Description</h3>
                <p className="modal-description">{fullEvent.description}</p>
              </div>
            )}

            {/* Bands on the Bill */}
            <div className="modal-section">
              <h3 className="modal-section-title">Bands on the Bill</h3>
              <div className="modal-bands-list">
                {fullEvent.bands && fullEvent.bands.length > 0 ? (
                  fullEvent.bands
                    .sort((a, b) => {
                      // Sort by performance_order if available
                      if (a.performance_order && b.performance_order) {
                        return a.performance_order - b.performance_order;
                      }
                      return 0;
                    })
                    .map((bandEvent, index) => (
                      <div key={bandEvent.id || index} className="modal-band-item">
                        <div className="band-item-header">
                          {bandEvent.performance_order && (
                            <span className="band-order">#{bandEvent.performance_order}</span>
                          )}
                          <span className="band-name">{bandEvent.band_name}</span>
                          <span className={`band-status ${bandEvent.status}`}>
                            {bandEvent.status}
                          </span>
                        </div>
                        {(bandEvent.set_time || bandEvent.set_length_minutes) && (
                          <div className="band-item-details">
                            {bandEvent.set_time && (
                              <span className="band-detail">
                                Set Time: {formatTime(bandEvent.set_time)}
                              </span>
                            )}
                            {bandEvent.set_length_minutes && (
                              <span className="band-detail">
                                Length: {bandEvent.set_length_minutes} minutes
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="modal-no-bands">No bands scheduled yet</div>
                )}
              </div>
            </div>

            {/* Backline Section - Band View Only */}
            {bandId && fullEvent.bands && fullEvent.bands.length > 0 && (
              <div className="modal-section">
                <h3 className="modal-section-title">Backline</h3>
                {loadingBackline ? (
                  <div className="backline-loading">Loading backline equipment...</div>
                ) : backlineData && backlineData.by_category && Object.keys(backlineData.by_category).length > 0 ? (
                  <div className="backline-list">
                    {Object.entries(backlineData.by_category).map(([category, items]) => {
                      // Category display labels
                      const categoryLabels = {
                        guitar_amp: "Guitar Amp",
                        bass_amp: "Bass Amp",
                        keyboard_amp: "Keyboard Amp",
                        drum_kit: "Drum Kit",
                        keyboard: "Keyboard",
                      };
                      
                      const categoryLabel = categoryLabels[category] || category;
                      const canClaim = bandId && userHasCategory[category] === true;
                      const hasClaimedItem = items.some(item => item.is_claimed);
                      // Check if current user has claimed an item in this category
                      const userHasClaimed = items.some(item => item.can_unclaim === true);
                      
                      return (
                        <div key={category} className="backline-category-group">
                          <div className="backline-category-header">
                            <h4 className="backline-category-title">
                              {categoryLabel}
                              {hasClaimedItem && (
                                <span className="backline-claimed-badge" title="Equipment claimed for backline">
                                  ✓ Claimed
                                </span>
                              )}
                            </h4>
                            {canClaim && !userHasClaimed && (
                              <button 
                                className="backline-claim-btn"
                                onClick={() => handleClaimClick(category)}
                              >
                                Claim
                              </button>
                            )}
                          </div>
                          <div className="backline-items">
                            {items.map((item, idx) => {
                              const isClaimed = item.is_claimed;
                              const canUnclaim = item.can_unclaim === true;
                              
                              return (
                                <div 
                                  key={`${item.equipment_id}-${idx}`} 
                                  className={`backline-item ${isClaimed ? "claimed" : ""}`}
                                >
                                  {isClaimed && (
                                    <div className="backline-claimed-indicator">
                                      <span className="claimed-icon">✓</span>
                                      <span className="claimed-label">Claimed for Backline</span>
                                    </div>
                                  )}
                                  <div className="backline-item-info">
                                    <span className="backline-item-name">{item.name}</span>
                                    {item.band_name && (
                                      <span className="backline-item-band">from {item.band_name}</span>
                                    )}
                                    {item.member_name && (
                                      <span className="backline-item-member">by {item.member_name}</span>
                                    )}
                                  </div>
                                  {(item.brand || item.model) && (
                                    <div className="backline-item-details">
                                      {item.brand && <span>{item.brand}</span>}
                                      {item.brand && item.model && <span> - </span>}
                                      {item.model && <span>{item.model}</span>}
                                    </div>
                                  )}
                                  {item.specs && (
                                    <div className="backline-item-specs">{item.specs}</div>
                                  )}
                                  {item.notes && (
                                    <div className="backline-item-notes">{item.notes}</div>
                                  )}
                                  {canUnclaim && (
                                    <button
                                      className="backline-unclaim-btn"
                                      onClick={() => handleUnclaim(item.equipment_id)}
                                    >
                                      Unclaim
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="backline-empty">
                    No backline equipment available for sharing yet.
                  </div>
                )}
              </div>
            )}

            {/* Event Schedule - Only for confirmed events */}
            {fullEvent.status === 'confirmed' && fullEvent.bands && fullEvent.bands.length > 0 && (() => {
              // If bandId is provided, find this band's schedule
              const viewingBandEvent = bandId 
                ? fullEvent.bands.find(be => be.band_id === parseInt(bandId))
                : null;
              
              // Show all bands' schedules, but highlight the viewing band's if provided
              const scheduleBands = fullEvent.bands
                .sort((a, b) => {
                  // Sort by performance_order if available
                  if (a.performance_order && b.performance_order) {
                    return a.performance_order - b.performance_order;
                  }
                  return 0;
                })
                .filter(bandEvent => {
                  const loadInTime = bandEvent.load_in_time ? formatTime(bandEvent.load_in_time) : null;
                  const soundCheckTime = bandEvent.sound_check_time ? formatTime(bandEvent.sound_check_time) : null;
                  return loadInTime || soundCheckTime;
                });
              
              // If viewing as a band and this band has a schedule, show it prominently
              if (viewingBandEvent && (viewingBandEvent.load_in_time || viewingBandEvent.sound_check_time)) {
                const loadInTime = viewingBandEvent.load_in_time ? formatTime(viewingBandEvent.load_in_time) : null;
                const soundCheckTime = viewingBandEvent.sound_check_time ? formatTime(viewingBandEvent.sound_check_time) : null;
                
                return (
                  <div className="modal-section">
                    <h3 className="modal-section-title">Your Schedule</h3>
                    <div className="modal-schedule-list">
                      <div className="modal-schedule-item your-schedule">
                        <div className="schedule-band-name">{viewingBandEvent.band_name}</div>
                        <div className="schedule-times">
                          {loadInTime && (
                            <div className="schedule-time">
                              <span className="schedule-time-label">Load In:</span>
                              <span className="schedule-time-value">{loadInTime}</span>
                            </div>
                          )}
                          {soundCheckTime && (
                            <div className="schedule-time">
                              <span className="schedule-time-label">Sound Check:</span>
                              <span className="schedule-time-value">{soundCheckTime}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {scheduleBands.length > 1 && (
                      <>
                        <h3 className="modal-section-title" style={{ marginTop: '20px' }}>Full Event Schedule</h3>
                        <div className="modal-schedule-list">
                          {scheduleBands.map((bandEvent, index) => {
                            const loadInTime = bandEvent.load_in_time ? formatTime(bandEvent.load_in_time) : null;
                            const soundCheckTime = bandEvent.sound_check_time ? formatTime(bandEvent.sound_check_time) : null;
                            
                            return (
                              <div key={bandEvent.id || index} className="modal-schedule-item">
                                <div className="schedule-band-name">{bandEvent.band_name}</div>
                                <div className="schedule-times">
                                  {loadInTime && (
                                    <div className="schedule-time">
                                      <span className="schedule-time-label">Load In:</span>
                                      <span className="schedule-time-value">{loadInTime}</span>
                                    </div>
                                  )}
                                  {soundCheckTime && (
                                    <div className="schedule-time">
                                      <span className="schedule-time-label">Sound Check:</span>
                                      <span className="schedule-time-value">{soundCheckTime}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              }
              
              // Otherwise show all schedules (venue view or band without schedule)
              if (scheduleBands.length === 0) return null;
              
              return (
                <div className="modal-section">
                  <h3 className="modal-section-title">Event Schedule</h3>
                  <div className="modal-schedule-list">
                    {scheduleBands.map((bandEvent, index) => {
                      const loadInTime = bandEvent.load_in_time ? formatTime(bandEvent.load_in_time) : null;
                      const soundCheckTime = bandEvent.sound_check_time ? formatTime(bandEvent.sound_check_time) : null;
                      
                      return (
                        <div key={bandEvent.id || index} className="modal-schedule-item">
                          <div className="schedule-band-name">{bandEvent.band_name}</div>
                          <div className="schedule-times">
                            {loadInTime && (
                              <div className="schedule-time">
                                <span className="schedule-time-label">Load In:</span>
                                <span className="schedule-time-value">{loadInTime}</span>
                              </div>
                            )}
                            {soundCheckTime && (
                              <div className="schedule-time">
                                <span className="schedule-time-label">Sound Check:</span>
                                <span className="schedule-time-value">{soundCheckTime}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Event Backline - Venue View */}
            {!bandId && (() => {
              // Define all backline categories
              const backlineCategories = [
                { key: "guitar_amp", label: "Guitar Amp" },
                { key: "bass_amp", label: "Bass Amp" },
                { key: "keyboard_amp", label: "Keyboard Amp" },
                { key: "drum_kit", label: "Drum Kit" },
                { key: "keyboard", label: "Keyboard" },
              ];

              if (loadingBackline) {
                return (
                  <div className="modal-section">
                    <h3 className="modal-section-title">Event Backline</h3>
                    <div className="backline-loading">Loading backline information...</div>
                  </div>
                );
              }

              if (!backlineData || !backlineData.by_category) {
                return null;
              }

              return (
                <div className="modal-section">
                  <h3 className="modal-section-title">Event Backline</h3>
                  <div className="venue-backline-list">
                    {backlineCategories.map(({ key, label }) => {
                      const categoryItems = backlineData.by_category[key] || [];
                      const claimedItem = categoryItems.find(item => item.is_claimed);
                      
                      return (
                        <div key={key} className="venue-backline-item">
                          <div className="venue-backline-category-header">
                            <h4 className="venue-backline-category-name">{label}</h4>
                            <span className={`venue-backline-status ${claimedItem ? "claimed" : "unclaimed"}`}>
                              {claimedItem ? "✓ Claimed" : "Not Claimed"}
                            </span>
                          </div>
                          
                          {claimedItem ? (
                            <div className="venue-backline-claimed-details">
                              <div className="venue-backline-equipment-name">{claimedItem.name}</div>
                              {(claimedItem.brand || claimedItem.model) && (
                                <div className="venue-backline-equipment-brand">
                                  {claimedItem.brand && <span>{claimedItem.brand}</span>}
                                  {claimedItem.brand && claimedItem.model && <span> - </span>}
                                  {claimedItem.model && <span>{claimedItem.model}</span>}
                                </div>
                              )}
                              <div className="venue-backline-supplier">
                                <span className="venue-backline-supplier-label">Supplied by:</span>
                                <span className="venue-backline-supplier-name">
                                  {claimedItem.member_name || "Unknown Member"}
                                </span>
                                {claimedItem.band_name && (
                                  <>
                                    <span className="venue-backline-supplier-separator">from</span>
                                    <span className="venue-backline-supplier-band">{claimedItem.band_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="venue-backline-unclaimed">
                              <span className="venue-backline-unclaimed-text">No equipment claimed for this category</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Ticket Information */}
            {fullEvent.is_ticketed && (
              <div className="modal-section">
                <h3 className="modal-section-title">Ticket Information</h3>
                <div className="modal-info-row">
                  <span className="modal-info-label">Price:</span>
                  <span className="modal-info-value modal-price">
                    {fullEvent.ticket_price ? formatCurrency(fullEvent.ticket_price) : 'Free'}
                  </span>
                </div>
              </div>
            )}

            {/* Age Restriction */}
            {fullEvent.is_age_restricted && (
              <div className="modal-section">
                <h3 className="modal-section-title">Age Restriction</h3>
                <div className="modal-info-row">
                  <span className="modal-info-label">Minimum Age:</span>
                  <span className="modal-info-value">{fullEvent.age_restriction}+</span>
                </div>
              </div>
            )}

            {/* Venue Information */}
            <div className="modal-section">
              <h3 className="modal-section-title">Venue</h3>
              <div className="modal-info-row">
                <span className="modal-info-value">{fullEvent.venue_name}</span>
              </div>
            </div>

            {/* Band Applications */}
            {fullEvent.status === 'pending' && (
              <div className="modal-section">
                <h3 className="modal-section-title">Band Applications</h3>
                <div className="modal-info-row" style={{ marginBottom: '12px' }}>
                  <span className="modal-info-label">Open for Applications:</span>
                  <span className={`modal-info-value ${fullEvent.is_open_for_applications ? 'text-success' : 'text-muted'}`}>
                    {fullEvent.is_open_for_applications ? 'Yes' : 'No'}
                  </span>
                </div>
                <EventApplicationsList 
                  eventId={fullEvent.id} 
                  isOpenForApplications={fullEvent.is_open_for_applications}
                  onApplicationReviewed={async () => {
                    // Refresh event details after application review
                    try {
                      const eventDetails = await eventService.getEvent(event.id);
                      setFullEvent(eventDetails);
                    } catch (err) {
                      console.error("Error refreshing event details:", err);
                    }
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* Claim Equipment Modal */}
        {claimModalOpen && claimingCategory && (
          <ClaimEquipmentModal
            eventId={fullEvent.id}
            bandId={bandId}
            category={claimingCategory}
            categoryLabel={
              {
                guitar_amp: "Guitar Amp",
                bass_amp: "Bass Amp",
                keyboard_amp: "Keyboard Amp",
                drum_kit: "Drum Kit",
                keyboard: "Keyboard",
              }[claimingCategory] || claimingCategory
            }
            onClose={() => {
              setClaimModalOpen(false);
              setClaimingCategory(null);
            }}
            onClaimSuccess={handleClaimSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default EventModal;
