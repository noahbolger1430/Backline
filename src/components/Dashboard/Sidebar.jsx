import React from "react";

const Sidebar = ({ activeTab, onTabChange, isVenue = false }) => {
  const baseTabs = [
    { id: "band", icon: "👥", label: "Band" },
    { id: "calendar", icon: "📅", label: "Calendar" },
    { id: "venues", icon: "🏢", label: "Venues" },
    { id: "gigs", icon: "🎸", label: "Gigs" },
    { id: "tools", icon: "🛠️", label: "Tools" } // Added Tools tab
  ];
  
  const venueTabs = [
    { id: "events", icon: "🎟️", label: "Events" },
    { id: "calendar", icon: "📅", label: "Calendar" }
  ];

  const tabs = isVenue ? venueTabs : baseTabs;

  const handleTabClick = (tabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <aside className="dashboard-sidebar">
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
            title={tab.label}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
