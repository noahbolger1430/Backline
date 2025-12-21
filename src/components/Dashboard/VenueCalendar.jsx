import React, { useState, useEffect } from "react";
import { eventService } from "../../services/eventService";

const VenueCalendar = ({ venueId, onEventClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventsByDate, setEventsByDate] = useState(new Map());
  const [loading, setLoading] = useState(true);

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

  // Helper function to format date as YYYY-MM-DD
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Fetch events when month changes
  useEffect(() => {
    const fetchEvents = async () => {
      if (!venueId) return;

      try {
        setLoading(true);
        // Get first and last day of current month
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const startDateStr = formatDateString(firstDay);
        const endDateStr = formatDateString(lastDay);

        const response = await eventService.listEvents({
          venue_id: venueId,
          start_date: startDateStr,
          end_date: endDateStr,
        });

        // Create a Map of date -> event
        const eventsMap = new Map();
        if (response.events) {
          response.events.forEach((event) => {
            eventsMap.set(event.event_date, event);
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
  }, [venueId, currentDate]);

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
      const event = eventsByDate.get(dateStr);

      days.push(
        <div
          key={day}
          className={`calendar-day venue-calendar-day ${isToday ? "today" : ""} ${
            isSelected ? "selected" : ""
          } ${event ? "has-event" : ""}`}
          onClick={() => {
            setSelectedDate(dateObj);
            if (event && onEventClick) {
              onEventClick(event);
            }
          }}
        >
          <div className="day-number">{day}</div>
          {event && (
            <div className="day-event-info">
              <div className="event-name">{event.name}</div>
              <div className="event-time">{formatTime(event.show_time)}</div>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="calendar-container venue-calendar-container">
      <h2 className="calendar-title">Event Calendar</h2>

      <div className="calendar-controls">
        <button
          className="calendar-nav-btn"
          onClick={handlePreviousMonth}
          aria-label="Previous month"
        >
          ←
        </button>

        <div className="calendar-selectors">
          <select
            value={currentDate.getMonth()}
            onChange={handleMonthChange}
            className="calendar-select"
          >
            {monthNames.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>

          <select
            value={currentDate.getFullYear()}
            onChange={handleYearChange}
            className="calendar-select"
          >
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
        <div className="calendar-days">{loading ? <div>Loading...</div> : renderCalendarDays()}</div>
      </div>
    </div>
  );
};

export default VenueCalendar;
