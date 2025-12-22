import React from "react";
import "./ToolsView.css";

const ToolsView = ({ onToolSelect }) => {
  const tools = [
    {
      id: "stage-plot",
      name: "Stage Plot",
      description: "Create and edit your band's stage plot",
      icon: "🎭",
      available: true
    },
    {
      id: "setlist-builder",
      name: "Setlist Builder",
      description: "Build and manage your setlists",
      icon: "📋",
      available: false,
      comingSoon: true
    },
    {
      id: "contract-generator",
      name: "Contract Generator",
      description: "Generate performance contracts",
      icon: "📄",
      available: false,
      comingSoon: true
    },
    {
      id: "merch-tracker",
      name: "Merch Tracker",
      description: "Track merchandise sales and inventory",
      icon: "👕",
      available: false,
      comingSoon: true
    }
  ];

  const handleToolClick = (toolId) => {
    if (onToolSelect) {
      onToolSelect(toolId);
    }
  };

  return (
    <div className="tools-view">
      <div className="tools-header">
        <h2 className="tools-title">Band Tools</h2>
        <p className="tools-subtitle">Powerful tools to manage your band</p>
      </div>
      
      <div className="tools-grid">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className={`tool-card ${tool.available ? 'available' : 'unavailable'}`}
            onClick={() => tool.available && handleToolClick(tool.id)}
          >
            <div className="tool-icon">{tool.icon}</div>
            <h3 className="tool-name">{tool.name}</h3>
            <p className="tool-description">{tool.description}</p>
            {tool.comingSoon && (
              <div className="tool-badge">Coming Soon</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToolsView;
