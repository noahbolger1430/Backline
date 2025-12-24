import React, { useState, useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { stagePlotService } from "../../services/stagePlotService";
import * as THREE from "three";
import "./StagePlot.css";

// Equipment-specific 3D geometry renderer
const EquipmentGeometry = ({ equipmentId }) => {
  switch (equipmentId) {
    case "vocal-mic":
      return <cylinderGeometry args={[0.3, 0.3, 1.5, 16]} />;
    case "electric-guitar":
    case "acoustic-guitar":
    case "bass-guitar":
      return <boxGeometry args={[1.2, 0.2, 0.05]} />;
    case "guitar-amp":
    case "bass-amp":
    case "keyboard-amp":
      return <boxGeometry args={[0.8, 1.2, 0.6]} />;
    case "keyboard":
      return <boxGeometry args={[1.5, 0.2, 0.4]} />;
    case "di-box":
      return <boxGeometry args={[0.3, 0.2, 0.15]} />;
    case "drum-kit":
      return (
        <group>
          <mesh>
            <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
            <meshStandardMaterial color="#C5C6C7" />
          </mesh>
          <mesh position={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
            <meshStandardMaterial color="#C5C6C7" />
          </mesh>
          <mesh position={[-0.5, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
            <meshStandardMaterial color="#C5C6C7" />
          </mesh>
        </group>
      );
    default:
      return <boxGeometry args={[0.5, 0.5, 0.5]} />;
  }
};

const getEquipmentColor = (equipmentId) => {
  switch (equipmentId) {
    case "vocal-mic":
      return "#C5C6C7";
    case "electric-guitar":
    case "acoustic-guitar":
    case "bass-guitar":
      return "#8B4513";
    case "guitar-amp":
    case "bass-amp":
    case "keyboard-amp":
      return "#2F3843";
    case "keyboard":
      return "#1F2833";
    case "di-box":
      return "#6F22D2";
    case "drum-kit":
      return "#C5C6C7";
    default:
      return "#6F22D2";
  }
};

// Draggable Equipment Component
const DraggableEquipment = ({ item, onUpdate, onRemove }) => {
  const groupRef = useRef();
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const { raycaster, camera, gl, size } = useThree();

  const handlePointerDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    gl.domElement.style.cursor = 'grabbing';
  };

  useFrame((state, delta) => {
    if (isDragging && groupRef.current) {
      // Get mouse position in normalized device coordinates
      const mouse = new THREE.Vector2();
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((state.pointer.x * size.width) / 2 + size.width / 2) / size.width;
      const y = -((state.pointer.y * size.height) / 2 + size.height / 2) / size.height;
      mouse.set(x * 2 - 1, y * 2 + 1);

      raycaster.setFromCamera(mouse, camera);
      
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlane.current, intersection);
      
      if (intersection) {
        const STAGE_WIDTH = 10;
        const STAGE_DEPTH = 6;
        const margin = 0.5;
        
        const newX = Math.max(-STAGE_WIDTH / 2 + margin, Math.min(STAGE_WIDTH / 2 - margin, intersection.x));
        const newZ = Math.max(-STAGE_DEPTH / 2 + margin, Math.min(STAGE_DEPTH / 2 - margin, intersection.z));
        
        onUpdate(newX, newZ);
      }
    }
  });

  useEffect(() => {
    const handlePointerUp = (e) => {
      if (isDragging) {
        setIsDragging(false);
        gl.domElement.style.cursor = 'default';
        
        // Check for double click to remove
        if (e.detail === 2) {
          onRemove();
        }
      }
    };

    if (isDragging) {
      gl.domElement.addEventListener('pointerup', handlePointerUp);
      gl.domElement.addEventListener('pointerleave', handlePointerUp);
    }

    return () => {
      gl.domElement.removeEventListener('pointerup', handlePointerUp);
      gl.domElement.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [isDragging, gl, onRemove]);

  const color = hovered || isDragging ? "#6F22D2" : getEquipmentColor(item.id);

  return (
    <group ref={groupRef} position={[item.x, 0.1, item.z]}>
      {item.id !== "drum-kit" ? (
        <mesh
          ref={meshRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onPointerDown={handlePointerDown}
          castShadow
          receiveShadow
        >
          <EquipmentGeometry equipmentId={item.id} />
          <meshStandardMaterial
            color={color}
            metalness={0.3}
            roughness={0.7}
          />
        </mesh>
      ) : (
        <group
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onPointerDown={handlePointerDown}
        >
          <EquipmentGeometry equipmentId={item.id} />
        </group>
      )}
      
      {/* Label above equipment */}
      <Text
        position={[0, 1, 0]}
        fontSize={0.3}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {item.name}
      </Text>
    </group>
  );
};

// 3D Stage Component
const Stage3D = ({ stageItems, onItemUpdate, onItemRemove, draggedItem, onDrop }) => {
  const stageRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Stage dimensions (in 3D units)
  const STAGE_WIDTH = 10;
  const STAGE_DEPTH = 6;
  const STAGE_HEIGHT = 0.2;

  const handleStageClick = (e) => {
    if (draggedItem && onDrop) {
      e.stopPropagation();
      const intersection = e.intersections.find(i => i.object === e.object);
      if (intersection) {
        const point = intersection.point;
        onDrop(point.x, point.z);
      }
    }
  };

  return (
    <group ref={stageRef}>
      {/* Stage floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={handleStageClick}
      >
        <planeGeometry args={[STAGE_WIDTH, STAGE_DEPTH]} />
        <meshStandardMaterial
          color={hovered ? "#2F3843" : "#1F2833"}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Stage edges */}
      <mesh position={[0, STAGE_HEIGHT / 2, 0]}>
        <boxGeometry args={[STAGE_WIDTH, STAGE_HEIGHT, STAGE_DEPTH]} />
        <meshStandardMaterial
          color="#C5C6C7"
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>

      {/* Stage label */}
      <Text
        position={[0, 0.3, 0]}
        fontSize={1}
        color="#8E8E93"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        STAGE
      </Text>

      {/* Render equipment items */}
      {stageItems.map((item) => (
        <DraggableEquipment
          key={item.instanceId}
          item={item}
          onUpdate={(newX, newZ) => onItemUpdate(item.instanceId, newX, newZ)}
          onRemove={() => onItemRemove(item.instanceId)}
        />
      ))}
    </group>
  );
};

// Main Stage Plot Component
const StagePlot = ({ onBack, bandId, stagePlotId = null }) => {
  const [stageItems, setStageItems] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [nextId, setNextId] = useState(1);
  const [plotName, setPlotName] = useState("Default Stage Plot");
  const [plotDescription, setPlotDescription] = useState("");
  const [currentPlotId, setCurrentPlotId] = useState(stagePlotId);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // Load existing stage plot if stagePlotId is provided
  const loadStagePlot = useCallback(async () => {
    if (!stagePlotId) return;
    
    setIsLoading(true);
    try {
      const data = await stagePlotService.getStagePlot(stagePlotId);
      setPlotName(data.name);
      setPlotDescription(data.description || "");
      setCurrentPlotId(data.id);
      
      const formattedItems = stagePlotService.formatItemsFromApi(data.items);
      // Convert 2D coordinates to 3D (scale and center)
      const convertedItems = formattedItems.map(item => ({
        ...item,
        x: ((item.x - 400) / 600) * 10, // Convert from SVG coords to 3D
        z: ((item.y - 300) / 300) * 6,
      }));
      setStageItems(convertedItems);
      
      if (convertedItems.length > 0) {
        const maxId = Math.max(...convertedItems.map(item => item.instanceId));
        setNextId(maxId + 1);
      }
      
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to load stage plot:", error);
      setSaveStatus({ type: "error", message: "Failed to load stage plot" });
    } finally {
      setIsLoading(false);
    }
  }, [stagePlotId]);

  useEffect(() => {
    loadStagePlot();
  }, [loadStagePlot]);

  // Clear save status after 3 seconds
  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleSave = async () => {
    if (!bandId) {
      setSaveStatus({ type: "error", message: "No band selected" });
      return;
    }

    if (!currentPlotId && plotName === "Default Stage Plot") {
      setShowNameModal(true);
      return;
    }

    await saveStagePlot();
  };

  const saveStagePlot = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Convert 3D coordinates back to 2D for API (maintain compatibility)
      const convertedItems = stageItems.map(item => ({
        ...item,
        x: (item.x / 10) * 600 + 400, // Convert from 3D back to SVG coords
        y: (item.z / 6) * 300 + 300,
      }));
      
      const formattedItems = stagePlotService.formatItemsForApi(convertedItems);
      
      if (currentPlotId) {
        await stagePlotService.updateStagePlot(currentPlotId, {
          name: plotName,
          description: plotDescription || null,
          items: formattedItems,
          settings: {
            stage_width: 600,
            stage_height: 300,
            stage_x: 100,
            stage_y: 150,
          },
        });
        setSaveStatus({ type: "success", message: "Stage plot saved!" });
      } else {
        const newPlot = await stagePlotService.createStagePlot({
          band_id: bandId,
          name: plotName,
          description: plotDescription || null,
          items: formattedItems,
          settings: {
            stage_width: 600,
            stage_height: 300,
            stage_x: 100,
            stage_y: 150,
          },
        });
        setCurrentPlotId(newPlot.id);
        setSaveStatus({ type: "success", message: "Stage plot created!" });
      }
      
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save stage plot:", error);
      setSaveStatus({ type: "error", message: error.message || "Failed to save stage plot" });
    } finally {
      setIsSaving(false);
      setShowNameModal(false);
    }
  };

  const handleDragStart = (e, equipment) => {
    setDraggedItem(equipment);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDrop = (x, z) => {
    if (!draggedItem) return;

    // Check if drop is within stage bounds
    const STAGE_WIDTH = 10;
    const STAGE_DEPTH = 6;
    const margin = 0.5;

    if (
      x >= -STAGE_WIDTH / 2 + margin &&
      x <= STAGE_WIDTH / 2 - margin &&
      z >= -STAGE_DEPTH / 2 + margin &&
      z <= STAGE_DEPTH / 2 - margin
    ) {
      const newItem = {
        ...draggedItem,
        instanceId: nextId,
        x: x,
        z: z
      };

      setStageItems([...stageItems, newItem]);
      setNextId(nextId + 1);
      setHasUnsavedChanges(true);
    }

    setDraggedItem(null);
  };

  const handleItemDrag = (instanceId, newX, newZ) => {
    setStageItems(items =>
      items.map(item =>
        item.instanceId === instanceId
          ? { ...item, x: newX, z: newZ }
          : item
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleRemoveItem = (instanceId) => {
    setStageItems(stageItems.filter(item => item.instanceId !== instanceId));
    setHasUnsavedChanges(true);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmLeave) return;
    }
    onBack();
  };

  if (isLoading) {
    return (
      <div className="stage-plot-container">
        <div className="stage-plot-loading">
          <span>Loading stage plot...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-plot-container">
      <div className="stage-plot-header">
        <button className="back-button" onClick={handleBack}>
          <span className="back-arrow">←</span>
          Back to Tools
        </button>
        <div className="stage-plot-title-container">
          <h2 className="stage-plot-title">{plotName}</h2>
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">• Unsaved changes</span>
          )}
        </div>
        <div className="stage-plot-actions">
          {saveStatus && (
            <span className={`save-status save-status-${saveStatus.type}`}>
              {saveStatus.message}
            </span>
          )}
          <button 
            className="action-button save-button" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      
      <div className="stage-plot-editor">
        <div className="editor-canvas-3d">
          <Canvas
            shadows
            camera={{ position: [8, 6, 8], fov: 50 }}
            onCreated={({ gl }) => {
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
          >
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={1}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-far={50}
              shadow-camera-left={-10}
              shadow-camera-right={10}
              shadow-camera-top={10}
              shadow-camera-bottom={-10}
            />
            <pointLight position={[-10, 10, -10]} intensity={0.5} />

            {/* Camera Controls */}
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={20}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 2.2}
            />

            {/* Stage and Equipment */}
            <Stage3D
              stageItems={stageItems}
              onItemUpdate={handleItemDrag}
              onItemRemove={handleRemoveItem}
              draggedItem={draggedItem}
              onDrop={handleDrop}
            />

            {/* Grid helper */}
            <gridHelper args={[20, 20, "#2a2a2a", "#1a1a1a"]} />
          </Canvas>
          
          {/* Instructions overlay */}
          <div className="canvas-instructions">
            <p>🖱️ Left click + drag: Rotate view</p>
            <p>🖱️ Right click + drag: Pan</p>
            <p>🖱️ Scroll: Zoom</p>
            <p>🖱️ Click + drag equipment: Move</p>
            <p>🖱️ Double click equipment: Remove</p>
          </div>
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

      {/* Name Modal */}
      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Save Stage Plot</h3>
            <div className="modal-form">
              <label className="modal-label">
                Name
                <input
                  type="text"
                  className="modal-input"
                  value={plotName}
                  onChange={(e) => setPlotName(e.target.value)}
                  placeholder="Enter stage plot name"
                />
              </label>
              <label className="modal-label">
                Description (optional)
                <textarea
                  className="modal-textarea"
                  value={plotDescription}
                  onChange={(e) => setPlotDescription(e.target.value)}
                  placeholder="Enter description"
                  rows="3"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-button modal-button-secondary"
                onClick={() => setShowNameModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-button modal-button-primary"
                onClick={saveStagePlot}
                disabled={!plotName.trim() || isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StagePlot;
