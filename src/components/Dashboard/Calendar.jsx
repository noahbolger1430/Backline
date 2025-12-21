import React, { useState, useEffect } from "react";
import AvailabilityModal from "./AvailabilityModal";
import { availabilityService } from "../../services/availabilityService";
import { bandService } from "../../services/bandService";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const Calendar = ({ bandId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [clickedDate, setClickedDate] = useState(null);
  const [dateAvailability, setDateAvailability] = useState(new Map()); // Map<dateStr, {unavailableCount, unavailableMembers}>
  const [events, setEvents] = useState([]); // Array of events for the current month

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleMonthChange = (e) => {
    setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value, 10), 1));
  };

  const handleYearChange = (e) => {
    setCurrentDate(new Date(parseInt(e.target.value, 10), currentDate.getMonth(), 1));
  };
  
  const parseDateString = (dateString) => {
    // Parse YYYY-MM-DD format without timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  };

  // Helper function to format date as YYYY-MM-DD
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch availability and events when month changes
  useEffect(() => {
    const fetchData = async () => {
      if (!bandId) return;

      try {
        // Get first and last day of current month
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const startDateStr = formatDateString(firstDay);
        const endDateStr = formatDateString(lastDay);

        // Fetch both availability and events in parallel
        const [bandAvailability, eventsData] = await Promise.all([
          availabilityService.getBandAvailability(bandId, startDateStr, endDateStr),
          bandService.getBandEvents(bandId),
        ]);

        // Create a Map of date -> availability info
        const availabilityMap = new Map();
        bandAvailability.availability.forEach((entry) => {
          const unavailableMembers = entry.member_details.filter(
            (member) => member.status === "unavailable"
          );
          const unavailableCount = unavailableMembers.length;
          const totalMembers = entry.total_members;
          
          if (unavailableCount > 0) {
            availabilityMap.set(entry.date, {
              unavailableCount,
              totalMembers,
              unavailableMembers: unavailableMembers.map((m) => m.member_name),
            });
          }
        });
        setDateAvailability(availabilityMap);

        // Filter events for the current month
        const monthEvents = eventsData.filter((event) => {
          const eventDate = parseDateString(event.event_date);  // Use safe parser
          return (
            eventDate.getMonth() === currentDate.getMonth() &&
            eventDate.getFullYear() === currentDate.getFullYear()
          );
        });
        setEvents(monthEvents);
      } catch (error) {
        console.error("Error fetching data:", error);
        // Don't show error to user, just log it
      }
    };

    fetchData();
  }, [bandId, currentDate]);

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    for (let i = 0; i < firstDay; i += 1) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const isToday =
        day === new Date().getDate() &&
        currentDate.getMonth() === new Date().getMonth() &&
        currentDate.getFullYear() === new Date().getFullYear();

      const isSelected =
        selectedDate &&
        day === selectedDate.getDate() &&
        currentDate.getMonth() === selectedDate.getMonth() &&
        currentDate.getFullYear() === selectedDate.getFullYear();

      const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = formatDateString(dateObj);
      const availabilityInfo = dateAvailability.get(dateStr);
      const unavailableCount = availabilityInfo?.unavailableCount || 0;
      const totalMembers = availabilityInfo?.totalMembers || 0;
      const isAllUnavailable = unavailableCount > 0 && unavailableCount === totalMembers;
      const isSomeUnavailable = unavailableCount > 0 && unavailableCount < totalMembers;
      
      // Check if there's an event on this date
      const dayEvents = events.filter((event) => {
        const eventDate = formatDateString(parseDateString(event.event_date));  // Use safe parser
        return eventDate === dateStr;
      });
      const hasEvent = dayEvents.length > 0;
      const firstEvent = hasEvent ? dayEvents[0] : null;
      
      // Determine text to display
      let availabilityText = "";
      let eventText = "";
      if (hasEvent) {
        eventText = dayEvents.length === 1 
          ? firstEvent.venue_name || "Event"
          : `${dayEvents.length} events`;
      }
      if (unavailableCount === 1 && availabilityInfo?.unavailableMembers) {
        availabilityText = `${availabilityInfo.unavailableMembers[0]} unavailable`;
      } else if (unavailableCount > 1) {
        availabilityText = `${unavailableCount} band members unavailable`;
      }
      
      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isAllUnavailable ? "unavailable" : ""} ${isSomeUnavailable ? "partially-unavailable" : ""} ${hasEvent ? "has-event" : ""}`}
          onClick={() => {
            setSelectedDate(dateObj);
            setClickedDate(dateObj);
            setShowAvailabilityModal(true);
          }}
          title={eventText || availabilityText}
        >
          <div className="day-number">{day}</div>
          {hasEvent && firstEvent && (
            <div className="event-content">
              {firstEvent.image_path ? (
                <img
                  src={`${API_BASE_URL}/${firstEvent.image_path}`}
                  alt={firstEvent.name || "Event"}
                  className="event-thumbnail-small"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="event-thumbnail-placeholder">🎸</div>
              )}
              {eventText && (
                <div className="event-venue-text">{eventText}</div>
              )}
            </div>
          )}
          {availabilityText && !hasEvent && (
            <div className="availability-text">{availabilityText}</div>
          )}
        </div>,
      );
    }

    return days;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="calendar-container">
      <h2 className="calendar-title">Availability</h2>

      <div className="calendar-controls">
        <button className="calendar-nav-btn" onClick={handlePreviousMonth} aria-label="Previous month">
          ←
        </button>

        <div className="calendar-selectors">
          <select value={currentDate.getMonth()} onChange={handleMonthChange} className="calendar-select">
            {monthNames.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>

          <select value={currentDate.getFullYear()} onChange={handleYearChange} className="calendar-select">
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <button className="calendar-nav-btn" onClick={handleNextMonth} aria-label="Next month">
          →
        </button>
      </div>

      <div className="calendar-grid">
        <div className="calendar-header">
          <div className="calendar-day-name">Sun</div>
          <div className="calendar-day-name">Mon</div>
          <div className="calendar-day-name">Tue</div>
          <div className="calendar-day-name">Wed</div>
          <div className="calendar-day-name">Thu</div>
          <div className="calendar-day-name">Fri</div>
          <div className="calendar-day-name">Sat</div>
        </div>
        <div className="calendar-days">{renderCalendarDays()}</div>
      </div>

      {showAvailabilityModal && clickedDate && (() => {
        const clickedDateStr = formatDateString(clickedDate);
        const availabilityInfo = dateAvailability.get(clickedDateStr);
        // Check if current user is unavailable (we'll need to fetch this separately or pass it)
        // For now, we'll just check if there are any unavailable members
        const isCurrentlyUnavailable = availabilityInfo?.unavailableCount > 0;
        
        return (
          <AvailabilityModal
            date={clickedDate}
            isCurrentlyUnavailable={isCurrentlyUnavailable}
            onConfirm={async (status, note) => {
              if (bandId && (status === "unavailable" || status === "available")) {
                try {
                  // Format date as YYYY-MM-DD
                  const dateStr = formatDateString(clickedDate);
                  await availabilityService.setMemberAvailability(bandId, dateStr, status, note);
                  
                  // Refetch availability to update the display
                  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                  const startDateStr = formatDateString(firstDay);
                  const endDateStr = formatDateString(lastDay);
                  
                  const bandAvailability = await availabilityService.getBandAvailability(
                    bandId,
                    startDateStr,
                    endDateStr
                  );
                  
                  const availabilityMap = new Map();
                  bandAvailability.availability.forEach((entry) => {
                    const unavailableMembers = entry.member_details.filter(
                      (member) => member.status === "unavailable"
                    );
                    const unavailableCount = unavailableMembers.length;
                    
                    if (unavailableCount > 0) {
                      availabilityMap.set(entry.date, {
                        unavailableCount,
                        totalMembers: entry.total_members,
                        unavailableMembers: unavailableMembers.map((m) => m.member_name),
                      });
                    }
                  });
                  setDateAvailability(availabilityMap);
                  
                  setShowAvailabilityModal(false);
                  setClickedDate(null);
                } catch (error) {
                  console.error("Error setting availability:", error);
                  alert(`Failed to set availability: ${error.message}`);
                }
              } else {
                setShowAvailabilityModal(false);
                setClickedDate(null);
              }
            }}
            onCancel={() => {
              setShowAvailabilityModal(false);
              setClickedDate(null);
            }}
          />
        );
      })()}
    </div>
  );
};

export default Calendar;

