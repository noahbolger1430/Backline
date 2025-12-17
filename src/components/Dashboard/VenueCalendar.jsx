import React, { useState } from "react";

const VenueCalendar = ({ events, onEventClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const formatDateKey = (year, month, day) => {
    const monthStr = (month + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    return `${year}-${monthStr}-${dayStr}`;
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    for (let i = 0; i < firstDay; i += 1) {
      days.push(<div key={`empty-${i}`} className="venue-calendar-day empty" />);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
      const event = events[dateKey];

      const isToday =
        day === new Date().getDate() &&
        currentDate.getMonth() === new Date().getMonth() &&
        currentDate.getFullYear() === new Date().getFullYear();

      days.push(
        <div
          key={day}
          className={`venue-calendar-day ${isToday ? "today" : ""} ${event ? "has-event" : ""}`}
          onClick={() => onEventClick(event)}
        >
          <div className="day-number">{day}</div>
          {event && (
            <div className="day-event">
              <div className="event-title">{event.title}</div>
              <div className="event-bands">
                {event.bands.slice(0, 2).map((band, index) => (
                  <div key={index} className="event-band">
                    {band}
                  </div>
                ))}
                {event.bands.length > 2 && (
                  <div className="event-band-more">+{event.bands.length - 2} more</div>
                )}
              </div>
            </div>
          )}
        </div>,
      );
    }

    return days;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="venue-calendar-container">
      <h2 className="calendar-title">Availability</h2>

      <div className="calendar-controls">
        <button className="calendar-nav-btn" onClick={handlePreviousMonth}>
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

        <button className="calendar-nav-btn" onClick={handleNextMonth}>
          →
        </button>
      </div>

      <div className="venue-calendar-grid">
        <div className="calendar-header">
          <div className="calendar-day-name">Sunday</div>
          <div className="calendar-day-name">Monday</div>
          <div className="calendar-day-name">Tuesday</div>
          <div className="calendar-day-name">Wednesday</div>
          <div className="calendar-day-name">Thursday</div>
          <div className="calendar-day-name">Friday</div>
          <div className="calendar-day-name">Saturday</div>
        </div>
        <div className="venue-calendar-days">{renderCalendarDays()}</div>
      </div>
    </div>
  );
};

export default VenueCalendar;

