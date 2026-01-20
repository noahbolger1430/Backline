import React, { useState, useEffect, useRef } from "react";
import { eventService } from "../../services/eventService";
import "./CalendarWeeklyShared.css";
import "./VenueCalendarWeekly.css";

const VenueCalendarWeekly = ({ venueId, onEventClick, onViewChange }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [eventsByDate, setEventsByDate] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const hoursContainerRef = useRef(null);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

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

  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours * 60 + minutes) / 1440 * 100;
  };

  // Calculate event position based on time
  const getEventPosition = (timeString) => {
    if (!timeString) return 0;
    
    const [hours, minutes] = timeString.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    // Each hour is 60px, so position is (totalMinutes / 60) * 60px = totalMinutes px
    return totalMinutes;
  };

  // Calculate event height based on duration
  const getEventHeight = (startTime, endTime) => {
    if (!startTime) return 50; // Default height if no time
    if (!endTime) return 120; // Default 2-hour duration if no end time
    
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    const durationMinutes = endTotalMinutes - startTotalMinutes;
    
    // Minimum height of 30px, otherwise 1px per minute
    return Math.max(30, durationMinutes);
  };

  useEffect(() => {
    if (hoursContainerRef.current) {
      const now = new Date();
      const scrollPosition = (now.getHours() - 2) * 60;
      hoursContainerRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!venueId) return;

      try {
        setLoading(true);
        const weekDays = getWeekDays();
        const startDateStr = formatDateString(weekDays[0]);
        const endDateStr = formatDateString(weekDays[6]);

        const response = await eventService.listEvents({
          venue_id: venueId,
          start_date: startDateStr,
          end_date: endDateStr,
        });

        const eventsMap = new Map();
        if (response.events) {
          // For each event, we need to fetch full details to get band schedules
          const eventsWithDetails = await Promise.all(
            response.events.map(async (event) => {
              try {
                const fullEvent = await eventService.getEvent(event.id);
                return { ...event, bands: fullEvent.bands || [] };
              } catch (error) {
                console.error(`Error fetching event details for ${event.id}:`, error);
                return event;
              }
            })
          );

          eventsWithDetails.forEach((event) => {
            const dateKey = event.event_date;
            if (!eventsMap.has(dateKey)) {
              eventsMap.set(dateKey, []);
            }
            eventsMap.get(dateKey).push(event);
          });

          // Sort events by doors_time (or show_time if no doors_time) within each day
          eventsMap.forEach((events, date) => {
            events.sort((a, b) => {
              const aTime = a.doors_time || a.show_time;
              const bTime = b.doors_time || b.show_time;
              if (!aTime && !bTime) return 0;
              if (!aTime) return 1;
              if (!bTime) return -1;
              return aTime.localeCompare(bTime);
            });
          });
        }
        setEventsByDate(eventsMap);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [venueId, currentWeek]);

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const formatTime = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(":");
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get the earliest load-in time from all bands
  const getEarliestLoadInTime = (bands) => {
    if (!bands || bands.length === 0) return null;
    
    const loadInTimes = bands
      .filter(band => band.load_in_time)
      .map(band => band.load_in_time)
      .sort();
    
    return loadInTimes[0] || null;
  };

  // Get the event start time (doors time or show time)
  const getEventStartTime = (event) => {
    return event.doors_time || event.show_time;
  };

  const weekDays = getWeekDays();
  const currentTimePosition = getCurrentTimePosition();

  return (
    <div className="calendar-container venue-calendar-weekly-container">
      <div className="calendar-header-section">
        <h2 className="calendar-title">Event Calendar</h2>
        <div className="calendar-view-selector">
          <button
            className="view-selector-btn"
            onClick={() => onViewChange && onViewChange("month")}
          >
            Month
          </button>
          <button
            className="view-selector-btn active"
            onClick={() => onViewChange && onViewChange("week")}
          >
            Week
          </button>
        </div>
      </div>

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

      <div className="calendar-weekly-grid">
        <div className="weekly-time-column">
          <div className="weekly-day-header-spacer"></div>
          <div className="weekly-hours-labels">
            {hours.map(hour => (
              <div key={hour} className="weekly-hour-label">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
            ))}
          </div>
        </div>

        <div className="weekly-days-container">
          <div className="weekly-day-headers">
            {weekDays.map((day, index) => {
              const dateStr = formatDateString(day);
              const dayEvents = eventsByDate.get(dateStr) || [];
              
              return (
                <div key={index} className={`weekly-day-header ${isToday(day) ? 'today' : ''}`}>
                  <div className="weekly-day-name">{dayNames[index]}</div>
                  <div className="weekly-day-date">{day.getDate()}</div>
                  {dayEvents.length > 0 && (
                    <div className="weekly-day-event-count">{dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="weekly-days-content" ref={hoursContainerRef}>
            <div className="weekly-hours-grid">
              {hours.map(hour => (
                <div key={hour} className="weekly-hour-row"></div>
              ))}
            </div>

            <div className="weekly-days-columns">
              {weekDays.map((day, dayIndex) => {
                const dateStr = formatDateString(day);
                const dayEvents = eventsByDate.get(dateStr) || [];
                
                return (
                  <div key={dayIndex} className="weekly-day-column">
                    {dayEvents.map((event, eventIndex) => {
                      const eventElements = [];
                      
                      // Get earliest load-in time and event start time (doors)
                      const earliestLoadIn = getEarliestLoadInTime(event.bands);
                      const eventStartTime = getEventStartTime(event);
                      
                      // Add load-in block if there are load-in times
                      if (earliestLoadIn && event.bands) {
                        // Find the earliest sound check time
                        const soundCheckTimes = event.bands
                          .filter(band => band.sound_check_time)
                          .map(band => band.sound_check_time)
                          .sort();
                        const earliestSoundCheck = soundCheckTimes[0];
                        
                        if (earliestSoundCheck) {
                          const loadInPosition = getEventPosition(earliestLoadIn);
                          const loadInHeight = getEventHeight(earliestLoadIn, earliestSoundCheck);
                          
                          eventElements.push(
                            <div
                              key={`load-in-${event.id}`}
                              className="weekly-venue-event weekly-load-in"
                              onClick={() => onEventClick && onEventClick(event)}
                              style={{
                                top: `${loadInPosition}px`,
                                height: `${loadInHeight}px`,
                                opacity: 0.7
                              }}
                            >
                              <div className="weekly-event-content">
                                <div className="weekly-event-name">Load In - {event.name}</div>
                                <div className="weekly-event-time">
                                  {formatTime(earliestLoadIn)} - {formatTime(earliestSoundCheck)}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      }
                      
                      // Add sound check block if there are sound check times
                      if (event.bands && event.bands.some(band => band.sound_check_time)) {
                        const soundCheckTimes = event.bands
                          .filter(band => band.sound_check_time)
                          .map(band => band.sound_check_time)
                          .sort();
                        const earliestSoundCheck = soundCheckTimes[0];
                        
                        if (earliestSoundCheck && eventStartTime) {
                          const soundCheckPosition = getEventPosition(earliestSoundCheck);
                          const soundCheckHeight = getEventHeight(earliestSoundCheck, eventStartTime);
                          
                          eventElements.push(
                            <div
                              key={`sound-check-${event.id}`}
                              className="weekly-venue-event weekly-sound-check"
                              onClick={() => onEventClick && onEventClick(event)}
                              style={{
                                top: `${soundCheckPosition}px`,
                                height: `${soundCheckHeight}px`,
                                opacity: 0.7
                              }}
                            >
                              <div className="weekly-event-content">
                                <div className="weekly-event-name">Sound Check - {event.name}</div>
                                <div className="weekly-event-time">
                                  {formatTime(earliestSoundCheck)} - {formatTime(eventStartTime)}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      }
                      
                      // Add the main event block starting at doors time
                      const topPosition = getEventPosition(eventStartTime);
                      const eventHeight = getEventHeight(eventStartTime, event.end_time);
                      
                      eventElements.push(
                        <div
                          key={`event-${event.id}`}
                          className="weekly-venue-event"
                          onClick={() => onEventClick && onEventClick(event)}
                          style={{
                            top: `${topPosition}px`,
                            height: `${eventHeight}px`
                          }}
                        >
                          <div className="weekly-event-content">
                            <div className="weekly-event-name">{event.name}</div>
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
                      
                      return eventElements;
                    })}
                  </div>
                );
              })}

              {weekDays.some(day => isToday(day)) && (
                <div 
                  className="weekly-current-time-indicator"
                  style={{
                    top: `${currentTimePosition}%`,
                    left: `${weekDays.findIndex(day => isToday(day)) * (100 / 7)}%`,
                    width: `${100 / 7}%`
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="calendar-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default VenueCalendarWeekly;
