import React from "react";
import { getImageUrl } from "../../utils/imageUtils";

import { API_BASE_URL } from '../../config';

const EventsCarousel = ({ events }) => {
  const formatDate = (dateString) => {
    // Parse the date components manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in JS
    const options = { month: "short", day: "numeric", year: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const getEventLocation = (event) => {
    // For band-created events, use location_name
    if (event.created_by_band_id && event.location_name) {
      // Include city and state if available for better context
      const locationParts = [event.location_name];
      if (event.city) locationParts.push(event.city);
      if (event.state) locationParts.push(event.state);
      return locationParts.join(", ");
    }
    // For venue events, use venue_name
    if (event.venue_name) {
      return event.venue_name;
    }
    // Fallback to just venue name or location name
    return event.venueName || event.location_name || "Location TBA";
  };

  const getEventIcon = (event) => {
    // Different icons for band-created events vs venue events
    return event.created_by_band_id ? "🎤" : "🎵";
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
      <h3 className="carousel-title">
        Upcoming Events
        {events.length > 0 && (
          <span className="event-count-badge">{events.length}</span>
        )}
      </h3>
      
      {/* Map over ALL events instead of just showing the first one */}
      {events.map((event) => (
        <div key={event.id} className="event-card-upcoming">
          {event.image_path && (
            <div className="event-card-image">
              <img
                src={getImageUrl(event.image_path, API_BASE_URL)}
                alt={event.name || "Event"}
                className="event-thumbnail"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.parentElement.querySelector('.event-image-placeholder');
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
              <div className="event-image-placeholder" style={{ display: event.image_path ? 'none' : 'flex' }}>
                {getEventIcon(event)}
              </div>
            </div>
          )}
          {!event.image_path && (
            <div className="event-card-image">
              <div className="event-image-placeholder">
                {getEventIcon(event)}
              </div>
            </div>
          )}
          <div className="event-card-content">
            <div className="event-name">{event.name || "Event"}</div>
            <div className="event-venue">{getEventLocation(event)}</div>
            <div className="event-date">
              {formatDate(event.event_date || event.date)}
              {event.created_by_band_id && (
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '10px', 
                  backgroundColor: 'rgba(111, 34, 210, 0.2)',
                  color: '#6F22D2',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  Band Gig
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventsCarousel;
