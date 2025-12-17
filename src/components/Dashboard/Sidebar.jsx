import React from "react";

const Sidebar = ({ activeTab }) => {
  const tabs = [{ id: "calendar", icon: "📅", label: "Calendar" }];

  return (
    <aside className="dashboard-sidebar">
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
            title={tab.label}
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

