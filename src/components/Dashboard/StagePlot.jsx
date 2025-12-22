import React, { useState, useRef } from "react";
import "./StagePlot.css";

const StagePlot = ({ onBack }) => {
  const [stageItems, setStageItems] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [nextId, setNextId] = useState(1);
  const svgRef = useRef(null);

  const equipmentList = [
    { id: "vocal-mic", name: "Vocal Microphone", icon: "🎤" },
    { id: "electric-guitar", name: "Electric Guitar", icon: "🎸" },
    { id: "acoustic-guitar", name: "Acoustic Guitar", icon: "🪕" },
    { id: "bass-guitar", name: "Bass Guitar", icon: "🎸" },
    { id: "guitar-amp", name: "Guitar Amplifier", icon: "🔊" },
    { id: "bass-amp", name: "Bass Amplifier", icon: "🔊" },
    { id: "keyboard", name: "Keyboard", icon: "🎹" },
    { id: "keyboard-amp", name: "Keyboard Amplifier", icon: "🔊" },
    { id: "di-box", name: "DI Box", icon: "📦" },
    { id: "drum-kit", name: "Drum Kit", icon: "🥁" }
  ];

  const handleDragStart = (e, equipment) => {
    setDraggedItem(equipment);
    e.dataTransfer.effectAllowed = "copy";
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'custom-drag-image';
    dragImage.innerHTML = `
      <div class="drag-item-content">
        <span class="drag-item-icon">${equipment.icon}</span>
        <span class="drag-item-name">${equipment.name}</span>
      </div>
    `;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 35, 35);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    
    if (!draggedItem) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to SVG coordinates
    const svgX = (x / rect.width) * 800;
    const svgY = (y / rect.height) * 600;

    // Check if drop is within stage bounds (with some padding for the item size)
    const stageX = 100;
    const stageY = 150;
    const stageWidth = 600;
    const stageHeight = 300;
    const itemSize = 35; // Half of the item width/height for centering

    if (
      svgX >= stageX + itemSize &&
      svgX <= stageX + stageWidth - itemSize &&
      svgY >= stageY + itemSize &&
      svgY <= stageY + stageHeight - itemSize
    ) {
      const newItem = {
        ...draggedItem,
        instanceId: nextId,
        x: svgX,
        y: svgY
      };

      setStageItems([...stageItems, newItem]);
      setNextId(nextId + 1);
    }

    setDraggedItem(null);
  };

  const handleItemMouseDown = (e, item) => {
    e.preventDefault();
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    
    // Calculate offset from mouse to item center
    const startX = (e.clientX - rect.left) / rect.width * 800;
    const startY = (e.clientY - rect.top) / rect.height * 600;
    const offsetX = startX - item.x;
    const offsetY = startY - item.y;

    const handleMouseMove = (e) => {
      const x = (e.clientX - rect.left) / rect.width * 800;
      const y = (e.clientY - rect.top) / rect.height * 600;
      
      const newX = x - offsetX;
      const newY = y - offsetY;

      // Check if new position is within stage bounds
      const stageX = 100;
      const stageY = 150;
      const stageWidth = 600;
      const stageHeight = 300;
      const itemSize = 35;

      if (
        newX >= stageX + itemSize &&
        newX <= stageX + stageWidth - itemSize &&
        newY >= stageY + itemSize &&
        newY <= stageY + stageHeight - itemSize
      ) {
        setStageItems(items => items.map(i => 
          i.instanceId === item.instanceId
            ? { ...i, x: newX, y: newY }
            : i
        ));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRemoveItem = (instanceId) => {
    setStageItems(stageItems.filter(item => item.instanceId !== instanceId));
  };

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
          <svg 
            ref={svgRef}
            className="stage-svg" 
            viewBox="0 0 800 600"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
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
              pointerEvents="none"
            >
              STAGE
            </text>

            {/* Placed items */}
            {stageItems.map((item) => (
              <g 
                key={item.instanceId}
                className="stage-item"
                onMouseDown={(e) => handleItemMouseDown(e, item)}
                style={{ cursor: 'move' }}
              >
                <rect
                  x={item.x - 35}
                  y={item.y - 35}
                  width="70"
                  height="70"
                  fill="#6F22D2"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  rx="4"
                  opacity="0.9"
                />
                <text
                  x={item.x}
                  y={item.y - 5}
                  textAnchor="middle"
                  fontSize="28"
                  pointerEvents="none"
                >
                  {item.icon}
                </text>
                
                {/* Name with background for better readability */}
                <rect
                  x={item.x - 35}
                  y={item.y + 15}
                  width="70"
                  height="20"
                  fill="#6F22D2"
                  opacity="0.95"
                />
                <text
                  x={item.x}
                  y={item.y + 28}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="9"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {item.name}
                </text>
                
                {/* Remove button */}
                <circle
                  cx={item.x + 30}
                  cy={item.y - 30}
                  r="10"
                  fill="#FF4444"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveItem(item.instanceId);
                  }}
                />
                <text
                  x={item.x + 30}
                  y={item.y - 26}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="14"
                  fontWeight="bold"
                  style={{ cursor: 'pointer' }}
                  pointerEvents="none"
                >
                  ×
                </text>
              </g>
            ))}
          </svg>
        </div>
        
        <div className="editor-sidebar">
          <h3 className="sidebar-title">Equipment</h3>
          <p className="sidebar-hint">Drag items onto the stage</p>
          <div className="equipment-list">
            {equipmentList.map((equipment) => (
              <div
                key={equipment.id}
                className="equipment-item"
                draggable="true"
                onDragStart={(e) => handleDragStart(e, equipment)}
              >
                <div className="equipment-icon-box">
                  <span className="equipment-icon">{equipment.icon}</span>
                </div>
                <span className="equipment-name">{equipment.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StagePlot;
