import React, { useEffect, useState } from "react";
import { eventService } from "../../services/eventService";
import { equipmentService } from "../../services/equipmentService";
import EventApplicationsList from "./EventApplicationsList";
import ClaimEquipmentModal from "./ClaimEquipmentModal";
import PhysicalTicketsModal from "./PhysicalTicketsModal";
import BandTicketSalesModal from "./BandTicketSalesModal";
import EventEditForm from "./EventEditForm";
import { getImageUrl } from "../../utils/imageUtils";
import "./EventModal.css";

const EventModal = ({ event, onClose, bandId = null }) => {
  const [fullEvent, setFullEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backlineData, setBacklineData] = useState(null);
  const [userHasCategory, setUserHasCategory] = useState({}); // { category: boolean }
  const [loadingBackline, setLoadingBackline] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [claimingCategory, setClaimingCategory] = useState(null); // category being claimed
  const [physicalTicketsModalOpen, setPhysicalTicketsModalOpen] = useState(false);
  const [bandTicketSalesModalOpen, setBandTicketSalesModalOpen] = useState(false);

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

  if (!event) return null;

  const canEdit = bandId && fullEvent && fullEvent.created_by_band_id === parseInt(bandId);

  return (
    <div className="event-modal-overlay" onClick={onClose}>
      <div className="event-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {loading && <div className="modal-loading">Loading event details...</div>}
        
        {error && <div className="modal-error">Error loading event details: {error}</div>}

        {!loading && !error && fullEvent && (
          isEditing ? (
            <div className="modal-section edit-mode-section">
              <h2 className="modal-title" style={{ marginBottom: '24px' }}>Edit Event</h2>
              <EventEditForm
                event={fullEvent}
                onUpdate={async () => {
                  // Re-fetch event details to show updated data
                  if (event?.id) {
                    try {
                      setLoading(true);
                      const eventDetails = await eventService.getEvent(event.id);
                      setFullEvent(eventDetails);
                    } catch (err) {
                      console.error("Error refreshing event details:", err);
                    } finally {
                      setLoading(false);
                    }
                  }
                  setIsEditing(false);
                }}
                onCancel={() => setIsEditing(false)}
                startEditing={true}
                hideButtons={false}
              />
            </div>
          ) : (
            <>
              {/* Event Image */}
              {fullEvent.image_path && (
                <div className="modal-image-container">
                  <img 
                    src={getImageUrl(fullEvent.image_path, process.env.REACT_APP_API_URL || "http://localhost:8000")} 
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
              <div className="modal-header-content">
                <h2 className="modal-title">{fullEvent.name}</h2>
                {fullEvent.description && (
                  <p className="modal-description-header">{fullEvent.description}</p>
                )}
                {(fullEvent.venue_name || fullEvent.location_name) && (
                  <div className="modal-venue-location">
                    <span className="location-pin-icon">📍</span>
                    <span className="venue-location-text">
                      {fullEvent.venue_name || fullEvent.location_name}
                      {(fullEvent.venue_street_address || fullEvent.venue_city || fullEvent.venue_state || fullEvent.venue_zip_code ||
                        fullEvent.street_address || fullEvent.city || fullEvent.state || fullEvent.zip_code) && (
                        <>
                          , {[
                            fullEvent.venue_street_address || fullEvent.street_address,
                            fullEvent.venue_city || fullEvent.city,
                            fullEvent.venue_state || fullEvent.state,
                            fullEvent.venue_zip_code || fullEvent.zip_code
                          ].filter(Boolean).join(", ")}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div className="modal-header-badges">
                {canEdit && (
                  <button 
                    className="modal-edit-btn"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Event
                  </button>
                )}
                <span className={`status-badge ${getStatusBadgeClass(fullEvent.status)}`}>
                  {fullEvent.status}
                </span>
              </div>
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

            {/* Bands on the Bill */}
            <div className="modal-section">
              <h3 className="modal-section-title">Bands on the Bill</h3>
              <div className="modal-bands-grid">
                {fullEvent.bands && fullEvent.bands.length > 0 ? (
                  fullEvent.bands
                    .sort((a, b) => {
                      // Sort by performance_order if available
                      if (a.performance_order && b.performance_order) {
                        return a.performance_order - b.performance_order;
                      }
                      return 0;
                    })
                    .map((bandEvent, index) => {
                      const bandName = bandEvent.band_name || `Band ${bandEvent.band_id}`;
                      const bandImagePath = bandEvent.band_image_path || bandEvent.band?.image_path || null;
                      const apiBaseUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
                      const imageUrl = bandImagePath ? getImageUrl(bandImagePath, apiBaseUrl) : null;
                      
                      return (
                        <div key={bandEvent.id || index} className="modal-band-card">
                          <div className="modal-band-card-image-container">
                            {imageUrl ? (
                              <img 
                                src={imageUrl} 
                                alt={bandName} 
                                className="modal-band-card-image"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const placeholder = e.target.parentElement.querySelector('.modal-band-card-placeholder');
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="modal-band-card-placeholder" 
                              style={{ display: imageUrl ? 'none' : 'flex' }}
                            >
                              🎸
                            </div>
                            {bandEvent.performance_order && (
                              <div className="modal-band-order-badge">
                                #{bandEvent.performance_order}
                              </div>
                            )}
                          </div>
                          <div className="modal-band-card-content">
                            <div className="modal-band-card-name">{bandName}</div>
                            <div className={`modal-band-card-status ${bandEvent.status}`}>
                              {bandEvent.status}
                            </div>
                            {(bandEvent.set_time || bandEvent.set_length_minutes) && (
                              <div className="modal-band-card-details">
                                {bandEvent.set_time && (
                                  <div className="modal-band-card-detail">
                                    Set: {formatTime(bandEvent.set_time)}
                                  </div>
                                )}
                                {bandEvent.set_length_minutes && (
                                  <div className="modal-band-card-detail">
                                    {bandEvent.set_length_minutes} min
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
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
                {/* Physical Tickets button - venue view */}
                {!bandId && (
                  <button
                    className="physical-tickets-button"
                    onClick={() => setPhysicalTicketsModalOpen(true)}
                  >
                    🎫 Manage Physical Tickets
                  </button>
                )}
                {/* Band Ticket Sales button - band view */}
                {bandId && (
                  <button
                    className="physical-tickets-button"
                    onClick={() => setBandTicketSalesModalOpen(true)}
                  >
                    🎫 Manage Ticket Sales
                  </button>
                )}
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
                  venueId={fullEvent.venue_id}
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
        )
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

        {/* Physical Tickets Modal */}
        {physicalTicketsModalOpen && fullEvent && (
          <PhysicalTicketsModal
            event={fullEvent}
            onClose={() => setPhysicalTicketsModalOpen(false)}
          />
        )}

        {/* Band Ticket Sales Modal */}
        {bandTicketSalesModalOpen && fullEvent && bandId && (
          <BandTicketSalesModal
            event={fullEvent}
            bandId={bandId}
            onClose={() => setBandTicketSalesModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default EventModal;
