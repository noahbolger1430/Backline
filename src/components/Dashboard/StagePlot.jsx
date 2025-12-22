import React from "react";
import "./StagePlot.css";

const StagePlot = ({ onBack }) => {
  return (
    <div className="stage-plot-container">
      <div className="stage-plot-header">
        <button className="back-button" onClick={onBack}>
          <span className="back-arrow">←</span>
          Back to Tools
        </button>
        <h2 className="stage-plot-title">Stage Plot Editor</h2>
        <div className="stage-plot-actions">
          <button className="action-button save-button">Save</button>
          <button className="action-button export-button">Export</button>
        </div>
      </div>
      
      <div className="stage-plot-editor">
        <div className="editor-canvas">
          <svg className="stage-svg" viewBox="0 0 800 600">
            {/* Grid background */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a2a2a" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#0B0C10" />
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Stage */}
            <rect
              className="stage-rect"
              x="100"
              y="150"
              width="600"
              height="300"
              fill="#1F2833"
              stroke="#C5C6C7"
              strokeWidth="2"
            />
            
            {/* Stage label */}
            <text
              x="400"
              y="300"
              textAnchor="middle"
              fill="#8E8E93"
              fontSize="24"
              fontWeight="600"
            >
              STAGE
            </text>
          </svg>
        </div>
        
        <div className="editor-sidebar">
          <h3 className="sidebar-title">Equipment</h3>
          <p className="sidebar-hint">Drag and drop items onto the stage</p>
          <div className="equipment-list">
            {/* Equipment items will be added here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StagePlot;
