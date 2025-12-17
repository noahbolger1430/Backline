import React, { useState } from "react";
import Calendar from "./Calendar";
import EventsCarousel from "./EventsCarousel";
import Sidebar from "./Sidebar";
import "./Dashboard.css";

const BandDashboard = () => {
  const [selectedMember, setSelectedMember] = useState(0);

  const bandName = "The Electric Dreams";
  const bandMembers = [
    { name: "Alex Johnson", instrument: "Lead Guitar", isCurrentUser: true },
    { name: "Sam Williams", instrument: "Vocals" },
    { name: "Jordan Lee", instrument: "Bass" },
    { name: "Taylor Brown", instrument: "Drums" },
  ];

  const events = [
    { id: 1, venueName: "The Blue Note", date: "2024-02-15" },
    { id: 2, venueName: "Rock House", date: "2024-02-22" },
    { id: 3, venueName: "Jazz Corner", date: "2024-03-01" },
    { id: 4, venueName: "The Venue", date: "2024-03-08" },
    { id: 5, venueName: "Music Hall", date: "2024-03-15" },
  ];

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="app-logo">BackLine</h1>
        </div>
        <div className="header-center">
          <h2 className="band-name">{bandName}</h2>
        </div>
        <div className="header-right">{/* future user menu */}</div>
      </header>

      <div className="members-bar">
        <div className="members-container">
          {bandMembers.map((member, index) => (
            <button
              key={index}
              className={`member-pill ${member.isCurrentUser ? "active" : ""}`}
              onClick={() => setSelectedMember(index)}
            >
              <span className="member-name">{member.name}</span>
              <span className="member-instrument">{member.instrument}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-content">
        <Sidebar activeTab="calendar" />

        <div className="main-content">
          <Calendar />
        </div>

        <div className="events-sidebar">
          <EventsCarousel events={events} />
        </div>
      </div>
    </div>
  );
};

export default BandDashboard;

