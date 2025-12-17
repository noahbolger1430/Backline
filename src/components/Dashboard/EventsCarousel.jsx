import React, { useState } from "react";

const EventsCarousel = ({ events }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? events.length - 1 : prevIndex - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === events.length - 1 ? 0 : prevIndex + 1));
  };

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

      <div className="carousel-content">
        <button className="carousel-nav carousel-nav-prev" onClick={handlePrevious} aria-label="Previous event">
          ‹
        </button>

        <div className="event-card">
          <div className="event-venue">{events[currentIndex].venueName}</div>
          <div className="event-date">{formatDate(events[currentIndex].date)}</div>
        </div>

        <button className="carousel-nav carousel-nav-next" onClick={handleNext} aria-label="Next event">
          ›
        </button>
      </div>

      <div className="carousel-indicators">
        {events.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentIndex ? "active" : ""}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to event ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default EventsCarousel;

