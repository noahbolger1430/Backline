import React, { useState } from "react";
import VenueCalendar from "./VenueCalendar";
import Sidebar from "./Sidebar";
import EventModal from "./EventModal";
import "./Dashboard.css";

const VenueDashboard = () => {
  const [selectedStaff, setSelectedStaff] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const venueName = "The Blue Note";
  const staffMembers = [
    { name: "Alex Johnson", role: "Owner", isCurrentUser: true },
    { name: "Sam Williams", role: "Manager" },
    { name: "Jordan Lee", role: "Staff" },
    { name: "Taylor Brown", role: "Staff" },
  ];

  const events = {
    "2024-01-15": {
      id: 1,
      title: "Winter Jazz Night",
      bands: ["The Smooth Operators", "Jazz Collective"],
    },
    "2024-01-22": {
      id: 2,
      title: "Rock Revival",
      bands: ["Thunder Road", "Electric Dreams", "The Rebels"],
    },
    "2024-01-25": {
      id: 3,
      title: "Acoustic Sessions",
      bands: ["Sarah & The Strings"],
    },
    "2024-02-14": {
      id: 4,
      title: "Valentine's Special",
      bands: ["Love Notes", "The Romantics"],
    },
    "2024-02-28": {
      id: 5,
      title: "Month End Bash",
      bands: ["Party Starters", "Night Owls", "The Groove"],
    },
    "2024-03-17": {
      id: 6,
      title: "St. Patrick's Day",
      bands: ["Celtic Thunder", "The Shamrocks"],
    },
    "2024-03-25": {
      id: 7,
      title: "Spring Festival",
      bands: ["Garden Party", "Fresh Blooms"],
    },
  };

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

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="app-logo">BackLine</h1>
        </div>
        <div className="header-center">
          <h2 className="venue-name">{venueName}</h2>
        </div>
        <div className="header-right">{/* future user menu */}</div>
      </header>

      <div className="members-bar">
        <div className="members-container">
          {staffMembers.map((staff, index) => (
            <button
              key={index}
              className={`member-pill ${staff.isCurrentUser ? "active" : ""}`}
              onClick={() => setSelectedStaff(index)}
            >
              <span className="member-name">{staff.name}</span>
              <span className="member-instrument">{staff.role}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-content venue-dashboard-content">
        <Sidebar activeTab="calendar" />

        <div className="venue-main-content">
          <VenueCalendar events={events} onEventClick={handleEventClick} />
        </div>
      </div>

      {showModal && selectedEvent && <EventModal event={selectedEvent} onClose={handleCloseModal} />}
    </div>
  );
};

export default VenueDashboard;

