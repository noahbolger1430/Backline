import React, { useState, useEffect } from "react";
import VenueCalendar from "./VenueCalendar";
import Sidebar from "./Sidebar";
import EventModal from "./EventModal";
import LogoutModal from "./LogoutModal";
import EventsView from "./EventsView";
import VenueProfile from "./VenueProfile";
import NotificationBell from "./NotificationBell";
import { venueService } from "../../services/venueService";
import { authService } from "../../services/authService";
import logoImage from "../../logos/Backline logo.jpg";
import "./Dashboard.css";

const VenueDashboard = ({ venueId, onLogout }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [venue, setVenue] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("calendar");

  const [events, setEvents] = useState({});

  useEffect(() => {
    const fetchVenueData = async () => {
      if (!venueId) {
        setError("No venue ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [venueData, staffData] = await Promise.all([
          venueService.getVenueDetails(venueId),
          venueService.getVenueStaff(venueId),
        ]);

        setVenue(venueData);
        
        // Get current user email from token
        const getCurrentUserEmail = () => {
          try {
            const token = authService.getToken();
            if (token) {
              const payload = JSON.parse(atob(token.split('.')[1]));
              return payload.sub; // JWT "sub" field contains the email
            }
          } catch (e) {
            return null;
          }
          return null;
        };

        const currentUserEmail = getCurrentUserEmail();
        
        // Transform staff to match component format
        const transformedStaff = staffData.map((staff) => ({
          id: staff.id,
          name: staff.user_name || `User ${staff.user_id}`,
          role: staff.role,
          isCurrentUser: staff.user_email === currentUserEmail,
        }));

        setStaffMembers(transformedStaff);
        
        // TODO: Fetch events when events API is available
        // For now, set empty events object
        setEvents({});
      } catch (err) {
        setError(err.message);
        console.error("Error fetching venue data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVenueData();
  }, [venueId]);

  const handleEventClick = (event) => {
    if (event) {
      setSelectedEvent(event);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const handleEventCreated = () => {
    // Switch back to calendar view after event creation
    setActiveTab("calendar");
    // TODO: Refresh events data
  };

  const handleVenueUpdate = (updatedVenue) => {
    setVenue(updatedVenue);
  };

  // Helper function to get initials from name
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  // Sort staff members: current user last (so it appears on top/front)
  const sortedStaffMembers = [...staffMembers].sort((a, b) => {
    if (a.isCurrentUser) return 1;
    if (b.isCurrentUser) return -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-message">Loading venue data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="dashboard-container">
        <div className="error-message">Venue not found</div>
      </div>
    );
  }

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    if (onLogout) {
      onLogout();
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "events":
        return (
          <EventsView
            venueId={venueId}
            onEventCreated={handleEventCreated}
          />
        );
      case "calendar":
      default:
        return (
          <VenueCalendar 
            venueId={venueId} 
            onEventClick={handleEventClick} 
          />
        );
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <img src={logoImage} alt="BackLine" className="app-logo" />
        </div>
        <div className="header-center">
          <h2 className="venue-name">{venue.name}</h2>
        </div>
        <div className="header-right">
          <div className="member-bubbles">
            {sortedStaffMembers.length > 0 ? (
              sortedStaffMembers.map((staff, index) => (
                <div
                  key={staff.id || index}
                  className={`member-bubble ${staff.isCurrentUser ? "current-user" : ""}`}
                  title={staff.name}
                >
                  {getInitials(staff.name)}
                </div>
              ))
            ) : null}
          </div>
          <NotificationBell />
          <button className="profile-button" onClick={() => setShowProfile(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="#FFFFFF"/>
              <path d="M8 9C4.13401 9 1 10.3431 1 12V15H15V12C15 10.3431 11.866 9 8 9Z" fill="#FFFFFF"/>
            </svg>
            Profile
          </button>
          <button className="logout-button" onClick={handleLogoutClick}>
            Logout
          </button>
        </div>
      </header>

      {showProfile ? (
        <div className="profile-view-overlay">
          <div className="profile-view-container">
            <div className="profile-view-header">
              <h2>Venue Profile</h2>
              <button className="profile-close-button" onClick={() => setShowProfile(false)}>
                ×
              </button>
            </div>
            <VenueProfile venueId={venueId} onVenueUpdate={handleVenueUpdate} />
          </div>
        </div>
      ) : (
        <div className="dashboard-content venue-dashboard-content">
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
            isVenue={true}
          />

          <div className="venue-main-content">
            {renderMainContent()}
          </div>
        </div>
      )}

      {showModal && selectedEvent && <EventModal event={selectedEvent} onClose={handleCloseModal} />}
      
      {showLogoutModal && (
        <LogoutModal
          onConfirm={handleLogoutConfirm}
          onCancel={handleLogoutCancel}
        />
      )}
    </div>
  );
};

export default VenueDashboard;
