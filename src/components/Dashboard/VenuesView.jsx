import React, { useState, useEffect } from "react";
import { venueService } from "../../services/venueService";
import "./Dashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const VenuesView = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        setLoading(true);
        const response = await venueService.listVenues();
        setVenues(response.venues || []);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching venues:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVenues();
  }, []);

  const formatLocation = (venue) => {
    const parts = [];
    if (venue.city) parts.push(venue.city);
    if (venue.state) parts.push(venue.state);
    return parts.join(", ") || "Location not specified";
  };

  if (loading) {
    return (
      <div className="venues-view">
        <div className="loading-message">Loading venues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="venues-view">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="venues-view">
      <h2 className="venues-title">Explore Venues</h2>
      <div className="venues-grid">
        {venues.length === 0 ? (
          <div className="no-venues">No venues available</div>
        ) : (
          venues.map((venue) => (
            <div key={venue.id} className="venue-card">
              <div className="venue-image-placeholder">
                {venue.image_path ? (
                  <img 
                    src={`${API_BASE_URL}/${venue.image_path}`} 
                    alt={venue.name}
                    className="venue-image"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      e.target.style.display = 'none';
                      const icon = e.target.parentElement.querySelector('.venue-image-icon');
                      if (icon) icon.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span className="venue-image-icon" style={{ display: venue.image_path ? 'none' : 'flex' }}>
                  🏢
                </span>
              </div>
              <div className="venue-card-content">
                <h3 className="venue-name">{venue.name}</h3>
                <p className="venue-location">{formatLocation(venue)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VenuesView;
