import React, { useState, useEffect } from "react";
import { venueService } from "../../services/venueService";
import "./Dashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const VenuesView = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedVenues, setExpandedVenues] = useState({});
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterMinCapacity, setFilterMinCapacity] = useState("");
  const [filterHasContact, setFilterHasContact] = useState(false); // checkbox: true = only show venues with contact info

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

  const formatFullAddress = (venue) => {
    const parts = [];
    if (venue.street_address) parts.push(venue.street_address);
    if (venue.city) parts.push(venue.city);
    if (venue.state) parts.push(venue.state);
    if (venue.zip_code) parts.push(venue.zip_code);
    return parts.join(", ") || "Address not specified";
  };

  const toggleVenueExpansion = (venueId) => {
    setExpandedVenues((prev) => ({
      ...prev,
      [venueId]: !prev[venueId],
    }));
  };

  const formatContactInfo = (venue) => {
    const contactParts = [];
    if (venue.contact_name) contactParts.push(venue.contact_name);
    if (venue.contact_email) contactParts.push(venue.contact_email);
    if (venue.contact_phone) contactParts.push(venue.contact_phone);
    return contactParts.length > 0 ? contactParts.join(" • ") : "Contact info not available";
  };

  const hasContactInfo = (venue) => {
    return !!(venue.contact_name || venue.contact_email || venue.contact_phone);
  };

  // Filter and search logic
  const filteredVenues = venues.filter((venue) => {
    // Search query - matches name or location (city/state)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const nameMatch = venue.name?.toLowerCase().includes(query);
      const cityMatch = venue.city?.toLowerCase().includes(query);
      const stateMatch = venue.state?.toLowerCase().includes(query);
      if (!nameMatch && !cityMatch && !stateMatch) {
        return false;
      }
    }

    // Filter by name
    if (filterName.trim()) {
      const nameFilter = filterName.toLowerCase().trim();
      if (!venue.name?.toLowerCase().includes(nameFilter)) {
        return false;
      }
    }

    // Filter by location (city or state)
    if (filterLocation.trim()) {
      const locationFilter = filterLocation.toLowerCase().trim();
      const cityMatch = venue.city?.toLowerCase().includes(locationFilter);
      const stateMatch = venue.state?.toLowerCase().includes(locationFilter);
      if (!cityMatch && !stateMatch) {
        return false;
      }
    }

    // Filter by capacity
    if (filterMinCapacity) {
      const minCap = parseInt(filterMinCapacity, 10);
      if (!venue.capacity || venue.capacity < minCap) {
        return false;
      }
    }

    // Filter by contact info
    if (filterHasContact) {
      const hasContact = hasContactInfo(venue);
      if (!hasContact) {
        return false;
      }
    }

    return true;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setFilterName("");
    setFilterLocation("");
    setFilterMinCapacity("");
    setFilterHasContact(false);
  };

  const hasActiveFilters = () => {
    return !!(
      searchQuery.trim() ||
      filterName.trim() ||
      filterLocation.trim() ||
      filterMinCapacity ||
      filterHasContact
    );
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
      
      {/* Search and Filter Section */}
      <div className="venues-search-filter">
        <div className="venues-search-section">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="venues-search-input"
              placeholder="Search venues by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>

        <div className="venues-filter-section">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Filter by Name</label>
              <input
                type="text"
                className="filter-input"
                placeholder="Venue name..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Filter by Location</label>
              <input
                type="text"
                className="filter-input"
                placeholder="City or state..."
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Min Capacity</label>
              <input
                type="number"
                className="filter-input"
                placeholder="Min"
                min="0"
                value={filterMinCapacity}
                onChange={(e) => setFilterMinCapacity(e.target.value)}
              />
            </div>

            <div className="filter-group filter-checkbox-group">
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  className="filter-checkbox"
                  checked={filterHasContact}
                  onChange={(e) => setFilterHasContact(e.target.checked)}
                />
                <span>Has Contact Info</span>
              </label>
            </div>

            {hasActiveFilters() && (
              <button className="clear-filters-button" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters() && (
          <div className="filter-results-info">
            Showing {filteredVenues.length} of {venues.length} venues
          </div>
        )}
      </div>

      <div className="venues-grid">
        {venues.length === 0 ? (
          <div className="no-venues">No venues available</div>
        ) : filteredVenues.length === 0 ? (
          <div className="no-venues">No venues match your search criteria</div>
        ) : (
          filteredVenues.map((venue) => {
            const isExpanded = expandedVenues[venue.id] || false;
            return (
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
                  <p className="venue-contact">{formatContactInfo(venue)}</p>
                  <button
                    className="venue-expand-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVenueExpansion(venue.id);
                    }}
                    aria-expanded={isExpanded}
                  >
                    <span className="venue-expand-text">More Info</span>
                    <span className={`venue-caret ${isExpanded ? 'expanded' : ''}`}>▼</span>
                  </button>
                  {isExpanded && (
                    <div className="venue-expanded-content">
                      {venue.description && (
                        <div className="venue-info-section">
                          <h4 className="venue-info-label">Description</h4>
                          <p className="venue-info-value">{venue.description}</p>
                        </div>
                      )}
                      <div className="venue-info-section">
                        <h4 className="venue-info-label">Address</h4>
                        <p className="venue-info-value">{formatFullAddress(venue)}</p>
                      </div>
                      {venue.capacity && (
                        <div className="venue-info-section">
                          <h4 className="venue-info-label">Capacity</h4>
                          <p className="venue-info-value">{venue.capacity.toLocaleString()} people</p>
                        </div>
                      )}
                      <div className="venue-info-section">
                        <h4 className="venue-info-label">Amenities</h4>
                        <div className="venue-amenities">
                          {venue.has_sound_provided && (
                            <span className="venue-amenity-tag">Sound Provided</span>
                          )}
                          {venue.has_parking && (
                            <span className="venue-amenity-tag">Parking Available</span>
                          )}
                          {venue.age_restriction && (
                            <span className="venue-amenity-tag">Age {venue.age_restriction}+</span>
                          )}
                          {!venue.has_sound_provided && !venue.has_parking && !venue.age_restriction && (
                            <span className="venue-info-value">No amenities listed</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VenuesView;
