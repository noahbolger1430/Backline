import React, { useState, useEffect } from "react";
import EventCreateForm from "./EventCreateForm";
import EventEditForm from "./EventEditForm";
import EventApplicationsList from "./EventApplicationsList";
import { eventService } from "../../services/eventService";
import "./EventsView.css";

const EventCard = ({ event, onDelete, onUpdate, isExpanded, onToggleExpand }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

  const formatPrice = (priceInCents) => {
    if (priceInCents === null || priceInCents === undefined) return "Free";
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${event.name}"? This action cannot be undone.`)) {
      try {
        await onDelete(event.id);
      } catch (error) {
        alert(`Failed to delete event: ${error.message}`);
      }
    }
  };

  const handleCardClick = (e) => {
    // Don't toggle if clicking on delete button or edit form
    if (e.target.closest('.event-delete-btn') || e.target.closest('.event-edit-form-container')) {
      return;
    }
    onToggleExpand();
  };

  return (
    <div className="event-card-wrapper">
      <div 
        className={`event-card ${isExpanded ? 'expanded' : ''}`}
        onClick={handleCardClick}
      >
        <button
          className="event-delete-btn"
          onClick={handleDelete}
          aria-label="Delete event"
          title="Delete event"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 5.5C5.77614 5.5 6 5.72386 6 6V12C6 12.2761 5.77614 12.5 5.5 12.5C5.22386 12.5 5 12.2761 5 12V6C5 5.72386 5.22386 5.5 5.5 5.5Z" fill="#DC3545"/>
            <path d="M8 5.5C8.27614 5.5 8.5 5.72386 8.5 6V12C8.5 12.2761 8.27614 12.5 8 12.5C7.72386 12.5 7.5 12.2761 7.5 12V6C7.5 5.72386 7.72386 5.5 8 5.5Z" fill="#DC3545"/>
            <path d="M11 6C11 5.72386 10.7761 5.5 10.5 5.5C10.2239 5.5 10 5.72386 10 6V12C10 12.2761 10.2239 12.5 10.5 12.5C10.7761 12.5 11 12.2761 11 12V6Z" fill="#DC3545"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M14.5 2H11V1C11 0.447715 10.5523 0 10 0H6C5.44772 0 5 0.447715 5 1V2H1.5C1.22386 2 1 2.22386 1 2.5C1 2.77614 1.22386 3 1.5 3H2V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V3H14.5C14.7761 3 15 2.77614 15 2.5C15 2.22386 14.7761 2 14.5 2ZM6 1H10V2H6V1ZM13 13V3H3V13C3 13.5523 3.44772 14 4 14H12C12.5523 14 13 13.5523 13 13Z" fill="#DC3545"/>
          </svg>
        </button>
        <div className="event-card-left">
          <h3 className="event-card-title">{event.name}</h3>
          {event.description && (
            <p className="event-card-description">{event.description}</p>
          )}
        </div>

        <div className="event-card-center">
          <div className="event-card-details">
            {event.is_ticketed && (
              <span className="event-detail-badge ticketed">
                {formatPrice(event.ticket_price)}
              </span>
            )}
            {!event.is_ticketed && (
              <span className="event-detail-badge free">Free</span>
            )}
            {event.is_age_restricted && (
              <span className="event-detail-badge age-restricted">
                {event.age_restriction}+
              </span>
            )}
            {event.band_count > 0 && (
              <span className="event-detail-badge bands">
                {event.band_count} {event.band_count === 1 ? "Band" : "Bands"}
              </span>
            )}
          </div>
        </div>

        <div className="event-card-right">
          <div className="event-card-date">{formatDate(event.event_date)}</div>
          <div className="event-card-times">
            {event.doors_time && (
              <div className="event-time">
                <span className="time-label">Doors:</span>
                <span className="time-value">{formatTime(event.doors_time)}</span>
              </div>
            )}
            <div className="event-time">
              <span className="time-label">Show:</span>
              <span className="time-value">{formatTime(event.show_time)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="event-card-expanded">
          {/* Show applications for pending events without requiring edit mode */}
          {event.status === 'pending' && (
            <div className="event-applications-section">
              <h3 className="applications-section-title">Band Applications</h3>
              <EventApplicationsList 
                eventId={event.id} 
                isOpenForApplications={event.is_open_for_applications}
                onApplicationReviewed={async () => {
                  // Refresh event data after application review
                  if (onUpdate) {
                    onUpdate();
                  }
                }}
              />
            </div>
          )}
          <EventEditForm
            event={event}
            onUpdate={onUpdate}
            onCancel={() => onToggleExpand()}
          />
        </div>
      )}
    </div>
  );
};

const EventCardWrapper = ({ event, onDelete, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <EventCard
      event={event}
      onDelete={onDelete}
      onUpdate={onUpdate}
      isExpanded={isExpanded}
      onToggleExpand={handleToggleExpand}
    />
  );
};

const EventsView = ({ venueId, onEventCreated }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await eventService.listEvents({ venue_id: venueId });
      setEvents(response.events || []);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (venueId) {
      fetchEvents();
    }
  }, [venueId]);

  const handleEventCreated = () => {
    setShowCreateForm(false);
    fetchEvents();
    if (onEventCreated) {
      onEventCreated();
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
  };

  if (showCreateForm) {
    return (
      <EventCreateForm
        venueId={venueId}
        onEventCreated={handleEventCreated}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="events-view-container">
      <div className="events-view-header">
        <h2>Events</h2>
        <button
          className="btn-add-event"
          onClick={() => setShowCreateForm(true)}
        >
          <span className="btn-icon">+</span>
          Add New Event
        </button>
      </div>

      {loading && (
        <div className="events-loading">
          <p>Loading events...</p>
        </div>
      )}

      {error && (
        <div className="events-error">
          <p>{error}</p>
          <button onClick={fetchEvents} className="btn-retry">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="events-empty">
          <p>No events yet. Create your first event to get started!</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="events-list">
          {events.map((event, index) => (
            <EventCardWrapper
              key={`${event.id}-${event.event_date}-${index}`}
              event={event}
              onDelete={async (eventId) => {
                try {
                  // Backend handles extraction of original event ID from synthetic IDs
                  // Just pass the event ID as-is
                  await eventService.deleteEvent(eventId);
                  fetchEvents(); // Refresh the events list
                } catch (error) {
                  throw error; // Re-throw to be handled by EventCard
                }
              }}
              onUpdate={fetchEvents}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsView;
