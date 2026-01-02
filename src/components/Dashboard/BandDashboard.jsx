import React, { useState, useEffect } from "react";
import Calendar from "./Calendar";
import EventsCarousel from "./EventsCarousel";
import Sidebar from "./Sidebar";
import VenuesView from "./VenuesView";
import GigsView from "./GigsView";
import BandProfile from "./BandProfile";
import UserProfile from "./UserProfile";
import LogoutModal from "./LogoutModal";
import ToolsView from "./ToolsView";
import StagePlot from "./StagePlot";
import StagePlotList from "./StagePlotList";
import SetlistBuilder from "./SetlistBuilder";
import SetlistList from "./SetlistList";
import PracticeCompanion from "./PracticeCompanion";
import TourGenerator from "./TourGenerator";
import NotificationBell from "./NotificationBell";
import { bandService } from "../../services/bandService";
import { stagePlotService } from "../../services/stagePlotService";
import { authService } from "../../services/authService";
import { getImageUrl } from "../../utils/imageUtils";
import "./Dashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const BandDashboard = ({ bandId, onLogout }) => {
  const [band, setBand] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedStagePlotId, setSelectedStagePlotId] = useState(null);
  const [showStagePlotList, setShowStagePlotList] = useState(false);
  const [selectedSetlistId, setSelectedSetlistId] = useState(null);
  const [showSetlistList, setShowSetlistList] = useState(false);

  useEffect(() => {
    const fetchBandData = async () => {
      if (!bandId) {
        setError("No band ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [bandData, eventsData] = await Promise.all([
          bandService.getBandDetails(bandId),
          bandService.getBandEvents(bandId),
        ]);

        setBand(bandData);
        
        // Transform events to match EventsCarousel format
        // Sort by date (upcoming first) and take the most upcoming event
        const transformedEvents = eventsData
          .map((event) => ({
            id: event.id,
            venueName: event.venue_name,
            date: event.event_date,
            image_path: event.image_path,
            name: event.name,
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending
        setEvents(transformedEvents);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching band data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBandData();
  }, [bandId]);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleToolSelect = (toolId) => {
    if (toolId === "stage-plot") {
      // Show stage plot list first to let user choose
      setShowStagePlotList(true);
    } else if (toolId === "setlist-builder") {
      // Show setlist list first to let user choose
      setShowSetlistList(true);
    } else if (toolId === "practice-companion") {
      // Practice companion opens directly
      setSelectedTool(toolId);
    } else if (toolId === "tour-generator") {
      // Tour generator opens directly
      setSelectedTool(toolId);
    }
    setSelectedTool(toolId);
  };

  const handleBackToTools = () => {
    setSelectedTool(null);
    setSelectedStagePlotId(null);
    setShowStagePlotList(false);
    setSelectedSetlistId(null);
    setShowSetlistList(false);
  };

  const handleBackToStagePlotList = () => {
    setSelectedStagePlotId(null);
    setShowStagePlotList(true);
  };

  const handleStagePlotSelect = (stagePlotId) => {
    setSelectedStagePlotId(stagePlotId);
    setShowStagePlotList(false);
  };

  const handleCreateNewStagePlot = () => {
    setSelectedStagePlotId(null);
    setShowStagePlotList(false);
  };

  const handleBackToSetlistList = () => {
    setSelectedSetlistId(null);
    setShowSetlistList(true);
  };

  const handleSetlistSelect = (setlistId) => {
    setSelectedSetlistId(setlistId);
    setShowSetlistList(false);
  };

  const handleCreateNewSetlist = () => {
    setSelectedSetlistId(null);
    setShowSetlistList(false);
  };

  const handleSetlistSave = () => {
    // After saving, go back to list
    setSelectedSetlistId(null);
    setShowSetlistList(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    if (onLogout) {
      onLogout();
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const handleBandUpdate = (updatedBand) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandDashboard.jsx:handleBandUpdate',message:'Updating band state',data:{hasLogoPath:!!updatedBand.logo_path,logoPath:updatedBand.logo_path,bandId:updatedBand.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    setBand(updatedBand);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b2c6bf00-6bde-4c2b-a6a7-cfef785ca6be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BandDashboard.jsx:handleBandUpdate',message:'Band state updated',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-message">Loading band data...</div>
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

  if (!band) {
    return (
      <div className="dashboard-container">
        <div className="error-message">Band not found</div>
      </div>
    );
  }

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
  
  // Helper function to get initials from name
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };
  
  // Transform members to match component format
  const allMembers = band.members?.map((member) => ({
    id: member.id,
    name: member.user_name || `User ${member.user_id}`,
    instrument: member.instrument || "Unknown",
    isCurrentUser: member.user_email === currentUserEmail,
  })) || [];
  
  // Sort members: current user last (so it appears on top/front)
  const bandMembers = [...allMembers].sort((a, b) => {
    if (a.isCurrentUser) return 1;
    if (b.isCurrentUser) return -1;
    return 0;
  });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <img src="/favicon.jpg" alt="BackLine" className="app-logo" />
        </div>
        <div className="header-center">
          <h2 className="band-name">{band.name}</h2>
        </div>
        <div className="header-right">
          <div className="member-bubbles">
            {bandMembers.length > 0 ? (
              bandMembers.map((member, index) => (
                <div
                  key={member.id || index}
                  className={`member-bubble ${member.isCurrentUser ? "current-user" : ""}`}
                  title={member.name}
                >
                  {getInitials(member.name)}
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
              <h2>User Profile</h2>
              <button className="profile-close-button" onClick={() => setShowProfile(false)}>
                ×
              </button>
            </div>
            <UserProfile onUserUpdate={() => {}} />
          </div>
        </div>
      ) : (
        <div className="dashboard-content">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="main-content">
            {activeTab === "band" ? (
              <BandProfile band={band} onBandUpdate={handleBandUpdate} />
            ) : activeTab === "calendar" ? (
              <Calendar bandId={bandId} />
            ) : activeTab === "venues" ? (
              <VenuesView bandId={bandId} />
            ) : activeTab === "gigs" ? (
              <GigsView bandId={bandId} />
            ) : activeTab === "tools" ? (
              selectedTool === "stage-plot" ? (
                showStagePlotList ? (
                  <StagePlotList
                    bandId={bandId}
                    onBack={handleBackToTools}
                    onSelect={handleStagePlotSelect}
                    onCreateNew={handleCreateNewStagePlot}
                  />
                ) : (
                  <StagePlot 
                    onBack={handleBackToStagePlotList} 
                    bandId={bandId} 
                    stagePlotId={selectedStagePlotId}
                  />
                )
              ) : selectedTool === "setlist-builder" ? (
                showSetlistList ? (
                  <SetlistList
                    bandId={bandId}
                    onBack={handleBackToTools}
                    onSelect={handleSetlistSelect}
                    onCreateNew={handleCreateNewSetlist}
                  />
                ) : (
                  <SetlistBuilder
                    bandId={bandId}
                    setlistId={selectedSetlistId}
                    onBack={handleBackToSetlistList}
                    onSave={handleSetlistSave}
                  />
                )
              ) : selectedTool === "practice-companion" ? (
                <PracticeCompanion
                  bandId={bandId}
                  bandName={band?.name}
                  userId={currentUserEmail}
                  onBack={handleBackToTools}
                />
              ) : selectedTool === "tour-generator" ? (
                <TourGenerator
                  bandId={bandId}
                  onBack={handleBackToTools}
                />
              ) : (
                <ToolsView onToolSelect={handleToolSelect} />
              )
            ) : null}
          </div>

          {activeTab === "calendar" && (
            <div className="events-sidebar">
              <EventsCarousel events={events} />
            </div>
          )}
        </div>
      )}

      {showLogoutModal && (
        <LogoutModal
          onConfirm={handleLogoutConfirm}
          onCancel={handleLogoutCancel}
        />
      )}
    </div>
  );
};

export default BandDashboard;
