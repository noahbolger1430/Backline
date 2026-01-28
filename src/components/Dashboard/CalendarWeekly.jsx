import React, { useState, useEffect, useRef } from "react";
import { availabilityService } from "../../services/availabilityService";
import { bandService } from "../../services/bandService";
import { rehearsalService } from "../../services/rehearsalService";
import { eventService } from "../../services/eventService";
import { getImageUrl } from "../../utils/imageUtils";
import RehearsalEditModal from "./RehearsalEditModal";
import EventModal from "./EventModal";
import "./CalendarWeeklyShared.css";
import "./CalendarWeekly.css";

const CalendarWeekly = ({ bandId }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [dateAvailability, setDateAvailability] = useState(new Map());
  const [events, setEvents] = useState([]);
  const [fullEventDetails, setFullEventDetails] = useState(new Map());
  const [rehearsals, setRehearsals] = useState([]);
  const [showRehearsalEditModal, setShowRehearsalEditModal] = useState(false);
  const [selectedRehearsalInstance, setSelectedRehearsalInstance] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const scrollableRef = useRef(null);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Get the start of the week (Sunday)
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Get all days of the current week
  const getWeekDays = () => {
    const weekStart = getWeekStart(currentWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePreviousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  };

  // Get current time position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours * 60 + minutes);
  };

  // Convert time string to pixels from top
  const timeToPixels = (timeString) => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
  };

  const calculateEndTime = (startTime, durationMinutes) => {
    if (!startTime || !durationMinutes) return startTime;
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + (minutes || 0) + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  // Scroll to current time on mount and when week changes
  useEffect(() => {
    const performScroll = () => {
      if (!scrollableRef.current) return;

      // Find the weekly-time-grid-container which is the actual scrollable element
      const timeGridContainer = scrollableRef.current.querySelector('.weekly-time-grid-container');
      if (!timeGridContainer) return;

      // Calculate scroll position based on current time
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Check if today is in the current week
      const weekDays = getWeekDays();
      const today = new Date();
      const isTodayInWeek = weekDays.some(day => 
        day.getDate() === today.getDate() &&
        day.getMonth() === today.getMonth() &&
        day.getFullYear() === today.getFullYear()
      );

      let targetScrollTop;
      
      if (isTodayInWeek) {
        // Scroll to current time - 2 hours (120 minutes) for context
        targetScrollTop = Math.max(0, currentMinutes - 120);
      } else {
        // Default to 8 AM (480 minutes) for non-current weeks
        targetScrollTop = 480;
      }

      timeGridContainer.scrollTop = targetScrollTop;
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      performScroll();
      // Try again after a delay to handle async content
      setTimeout(performScroll, 500);
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentWeek]);

  // Fetch data when week changes
  useEffect(() => {
    const fetchData = async () => {
      if (!bandId) return;

      try {
        const weekDays = getWeekDays();
        const startDateStr = formatDateString(weekDays[0]);
        const endDateStr = formatDateString(weekDays[6]);

        const [bandAvailability, eventsData, rehearsalsData] = await Promise.all([
          availabilityService.getBandAvailability(bandId, startDateStr, endDateStr),
          bandService.getBandEvents(bandId),
          rehearsalService.getRehearsalsForCalendar(bandId, startDateStr, endDateStr),
        ]);

        // Process availability
        const availabilityMap = new Map();
        bandAvailability.availability.forEach((entry) => {
          const unavailableMembers = entry.member_details.filter(
            (member) => member.status === "unavailable"
          );
          if (unavailableMembers.length > 0) {
            availabilityMap.set(entry.date, {
              unavailableCount: unavailableMembers.length,
              totalMembers: entry.total_members,
              unavailableMembers: unavailableMembers.map((m) => m.member_name),
            });
          }
        });
        setDateAvailability(availabilityMap);

        // Filter events for the current week
        const weekEvents = eventsData.filter((event) => {
          const eventDateStr = event.event_date.split('T')[0];
          const [year, month, day] = eventDateStr.split('-').map(Number);
          const eventDate = new Date(year, month - 1, day);
          
          const weekStart = new Date(weekDays[0]);
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekDays[6]);
          weekEnd.setHours(23, 59, 59, 999);
          
          return eventDate >= weekStart && eventDate <= weekEnd;
        });
        setEvents(weekEvents);

        // Fetch full details for each event
        const eventDetailsMap = new Map();
        await Promise.all(
          weekEvents.map(async (event) => {
            try {
              const fullDetails = await eventService.getEvent(event.id);
              eventDetailsMap.set(event.id, fullDetails);
            } catch (error) {
              console.error(`Error fetching details for event ${event.id}:`, error);
            }
          })
        );
        setFullEventDetails(eventDetailsMap);
        
        setRehearsals(rehearsalsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [bandId, currentWeek]);

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const handleRehearsalClick = (rehearsal) => {
    setSelectedRehearsalInstance(rehearsal);
    setShowRehearsalEditModal(true);
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  // Render all event blocks for a single event (load-in, sound check, main event)
  const renderEventBlocks = (event) => {
    const eventBlocks = [];
    const fullDetails = fullEventDetails.get(event.id);
    
    // Find the current band's schedule
    const viewingBandEvent = bandId && fullDetails?.bands
      ? fullDetails.bands.find(be => be.band_id === parseInt(bandId))
      : null;

    const loadInTime = viewingBandEvent?.load_in_time;
    const soundCheckTime = viewingBandEvent?.sound_check_time;
    const doorsTime = event.doors_time || event.show_time;
    const endTime = event.end_time;

    // Load In block (from load_in_time to sound_check_time, or to doors if no sound check)
    if (loadInTime) {
      const loadInEnd = soundCheckTime || doorsTime;
      
      if (loadInEnd) {
        const topPosition = timeToPixels(loadInTime);
        const endPosition = timeToPixels(loadInEnd);
        const height = Math.max(30, endPosition - topPosition);
        
        eventBlocks.push(
          <div
            key={`loadin-${event.id}`}
            className="weekly-event weekly-load-in"
            onClick={() => handleEventClick(event)}
            style={{
              top: `${topPosition}px`,
              height: `${height}px`,
              zIndex: 3
            }}
          >
            <div className="weekly-event-content">
              <div className="weekly-event-name">Load In</div>
              <div className="weekly-event-times">
                <div className="weekly-event-time-row">
                  <span className="weekly-event-time-value">
                    {formatTime(loadInTime)} - {formatTime(loadInEnd)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      }
    }

    // Sound Check block (from sound_check_time to doors_time)
    if (soundCheckTime && doorsTime) {
      const topPosition = timeToPixels(soundCheckTime);
      const endPosition = timeToPixels(doorsTime);
      const height = Math.max(30, endPosition - topPosition);
      
      eventBlocks.push(
        <div
          key={`soundcheck-${event.id}`}
          className="weekly-event weekly-sound-check"
          onClick={() => handleEventClick(event)}
          style={{
            top: `${topPosition}px`,
            height: `${height}px`,
            zIndex: 4
          }}
        >
          <div className="weekly-event-content">
            <div className="weekly-event-name">Sound Check</div>
            <div className="weekly-event-times">
              <div className="weekly-event-time-row">
                <span className="weekly-event-time-value">
                  {formatTime(soundCheckTime)} - {formatTime(doorsTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Main Event block (from doors_time to end_time)
    const mainStartTime = doorsTime || '19:00';
    const mainEndTime = endTime || '23:00';
    const topPosition = timeToPixels(mainStartTime);
    const endPosition = timeToPixels(mainEndTime);
    const height = Math.max(40, endPosition - topPosition);
    
    eventBlocks.push(
      <div
        key={`event-${event.id}`}
        className="weekly-event weekly-main-event"
        onClick={() => handleEventClick(event)}
        style={{
          top: `${topPosition}px`,
          height: `${height}px`,
          zIndex: 5
        }}
      >
        <div className="weekly-event-content">
          <div className="weekly-event-name">
            {event.name || event.venue_name || 'Event'}
          </div>
          <div className="weekly-event-times">
            {event.doors_time && (
              <div className="weekly-event-time-row">
                <span className="weekly-event-time-label">Doors:</span>
                <span className="weekly-event-time-value">{formatTime(event.doors_time)}</span>
              </div>
            )}
            {event.show_time && (
              <div className="weekly-event-time-row">
                <span className="weekly-event-time-label">Show:</span>
                <span className="weekly-event-time-value">{formatTime(event.show_time)}</span>
              </div>
            )}
            {event.end_time && (
              <div className="weekly-event-time-row">
                <span className="weekly-event-time-label">End:</span>
                <span className="weekly-event-time-value">{formatTime(event.end_time)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return eventBlocks;
  };

  const weekDays = getWeekDays();
  const currentTimePosition = getCurrentTimePosition();
  const isCurrentWeek = weekDays.some(day => isToday(day));

  return (
    <div className="calendar-container calendar-weekly-container" ref={scrollableRef}>
      <div className="calendar-controls">
        <button className="calendar-nav-btn" onClick={handlePreviousWeek}>
          ←
        </button>
        <div className="calendar-week-display">
          {weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <button className="calendar-nav-btn" onClick={handleNextWeek}>
          →
        </button>
      </div>

      <div className="weekly-calendar-container">
        {/* Fixed Column Headers */}
        <div className="weekly-headers-row">
          <div className="weekly-corner-cell"></div>
          <div className="weekly-column-headers">
            {weekDays.map((day, index) => {
              const dateStr = formatDateString(day);
              const availabilityInfo = dateAvailability.get(dateStr);
              const unavailableCount = availabilityInfo?.unavailableCount || 0;
              const totalMembers = availabilityInfo?.totalMembers || 0;
              const isAllUnavailable = unavailableCount > 0 && unavailableCount === totalMembers;
              
              return (
                <div key={index} className={`weekly-column-header ${isToday(day) ? 'today' : ''}`}>
                  <div className="weekly-day-name">{dayNames[index]}</div>
                  <div className="weekly-day-date">{day.getDate()}</div>
                  {availabilityInfo && (
                    <div className={`weekly-availability-badge ${isAllUnavailable ? 'all-unavailable' : 'some-unavailable'}`}>
                      {unavailableCount} unavailable
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Time Grid */}
        <div className="weekly-time-grid-container">
          <div className="weekly-time-grid">
            {/* Time Labels */}
            <div className="weekly-time-column">
              {hours.map(hour => (
                <div key={hour} className="weekly-time-slot">
                  <div className="weekly-time-label">
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </div>
                </div>
              ))}
            </div>

            {/* Day Columns Grid */}
            <div className="weekly-days-grid">
              {/* Hour grid lines */}
              <div className="weekly-grid-lines">
                {hours.map(hour => (
                  <div key={hour} className="weekly-hour-line"></div>
                ))}
              </div>

              {/* Day columns with events */}
              <div className="weekly-columns">
                {weekDays.map((day, dayIndex) => {
                  const dateStr = formatDateString(day);
                  
                  const dayEvents = events.filter(e => {
                    const eventDateStr = e.event_date.split('T')[0];
                    return eventDateStr === dateStr;
                  });
                  
                  const dayRehearsals = rehearsals.filter(r => {
                    const rehearsalDateStr = r.instance_date.split('T')[0];
                    return rehearsalDateStr === dateStr;
                  });
                  
                  return (
                    <div key={dayIndex} className="weekly-day-column">
                      {/* Render all event blocks (load-in, sound check, main event) */}
                      {dayEvents.map((event) => renderEventBlocks(event))}

                      {/* Render rehearsal cards */}
                      {dayRehearsals.map((rehearsal, rehearsalIndex) => {
                        const topPosition = rehearsal.start_time ? timeToPixels(rehearsal.start_time) : 0;
                        const duration = rehearsal.duration_minutes || 60;
                        const height = Math.max(40, duration);
                        const endTime = calculateEndTime(rehearsal.start_time, duration);
                        
                        return (
                          <div
                            key={`rehearsal-${rehearsalIndex}`}
                            className="weekly-rehearsal"
                            onClick={() => handleRehearsalClick(rehearsal)}
                            style={{
                              top: `${topPosition}px`,
                              height: `${height}px`,
                              zIndex: 6
                            }}
                          >
                            <div className="weekly-rehearsal-content">
                              <div className="weekly-rehearsal-header">
                                <span className="weekly-rehearsal-icon">🎵</span>
                                <span className="weekly-rehearsal-time">
                                  {formatTime(rehearsal.start_time)} - {formatTime(endTime)}
                                </span>
                              </div>
                              {rehearsal.location && (
                                <div className="weekly-rehearsal-location">{rehearsal.location}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Current time indicator */}
              {isCurrentWeek && (
                <div 
                  className="weekly-current-time-line"
                  style={{
                    top: `${currentTimePosition}px`,
                    left: `${weekDays.findIndex(day => isToday(day)) * (100 / 7)}%`,
                    width: `${100 / 7}%`
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showEventModal && selectedEvent && (
        <EventModal
          event={selectedEvent}
          bandId={bandId}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {showRehearsalEditModal && selectedRehearsalInstance && (
        <RehearsalEditModal
          bandId={bandId}
          instanceId={selectedRehearsalInstance.id}
          onClose={() => {
            setShowRehearsalEditModal(false);
            setSelectedRehearsalInstance(null);
          }}
          onSuccess={() => {
            const weekDays = getWeekDays();
            const startDateStr = formatDateString(weekDays[0]);
            const endDateStr = formatDateString(weekDays[6]);
            
            rehearsalService.getRehearsalsForCalendar(bandId, startDateStr, endDateStr)
              .then(setRehearsals)
              .catch(console.error);
          }}
        />
      )}
    </div>
  );
};

export default CalendarWeekly;