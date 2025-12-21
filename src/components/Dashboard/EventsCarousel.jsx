import React from "react";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const EventsCarousel = ({ events }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { month: "short", day: "numeric", year: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  if (!events || events.length === 0) {
    return (
      <div className="events-carousel">
        <h3 className="carousel-title">Upcoming Events</h3>
        <div className="no-events">
          <p>No events booked yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="events-carousel">
      <h3 className="carousel-title">Upcoming Events</h3>
      
      {/* Map over ALL events instead of just showing the first one */}
      {events.map((event) => (
        <div key={event.id} className="event-card-upcoming">
          {event.image_path && (
            <div className="event-card-image">
              <img
                src={`${API_BASE_URL}/${event.image_path}`}
                alt={event.name || "Event"}
                className="event-thumbnail"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.parentElement.querySelector('.event-image-placeholder');
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
              <div className="event-image-placeholder" style={{ display: event.image_path ? 'none' : 'flex' }}>
                🎸
              </div>
            </div>
          )}
          {!event.image_path && (
            <div className="event-card-image">
              <div className="event-image-placeholder">
                🎸
              </div>
            </div>
          )}
          <div className="event-card-content">
            <div className="event-name">{event.name || "Event"}</div>
            <div className="event-venue">{event.venueName}</div>
            <div className="event-date">{formatDate(event.date)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventsCarousel;
