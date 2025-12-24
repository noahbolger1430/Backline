import React, { useState, useRef, useEffect, useCallback, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { stagePlotService } from "../../services/stagePlotService";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import "./StagePlot.css";

// Cache for processed amplifier models
const amplifierModelCache = new Map();
// Cache for processed drum kit models
const drumKitModelCache = new Map();
// Cache for processed keyboard models
const keyboardModelCache = new Map();
// Cache for processed microphone models
const microphoneModelCache = new Map();
// Cache for processed electric guitar models
const electricGuitarModelCache = new Map();
// Cache for processed bass guitar models
const bassGuitarModelCache = new Map();

// Process and cache amplifier model geometry (only once)
const processAmplifierModel = (obj) => {
  if (amplifierModelCache.has('processed')) {
    return amplifierModelCache.get('processed');
  }
  
  // Clone the object to avoid mutating the original
  const clonedObj = obj.clone();
  
  // Calculate bounding box to determine scale
  const box = new THREE.Box3().setFromObject(clonedObj);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  // Scale to fit approximately 1.2 units height (adjust as needed)
  const targetSize = 0.5;
  const scale = targetSize / maxDimension;
  
  // Center the model first (before scaling)
  const center = box.getCenter(new THREE.Vector3());
  clonedObj.position.sub(center);
  
  // Then apply scale
  clonedObj.scale.set(scale, scale, scale);
  
  // Store the processed geometry
  amplifierModelCache.set('processed', clonedObj);
  
  return clonedObj;
};

// Process and cache drum kit model geometry (only once)
const processDrumKitModel = (obj) => {
  // Clear cache to force reprocessing with new size
  if (drumKitModelCache.has('processed')) {
    drumKitModelCache.delete('processed');
  }
  
  // Clone the object to avoid mutating the original
  const clonedObj = obj.clone();
  
  // Reset position and rotation to ensure clean state
  clonedObj.position.set(0, 0, 0);
  clonedObj.rotation.set(0, 0, 0);
  clonedObj.scale.set(1, 1, 1);
  
  // Calculate bounding box to determine scale
  const box = new THREE.Box3().setFromObject(clonedObj);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  // Scale to fit approximately 1.44 units max dimension (20% larger than 1.2)
  const targetSize = 2.0;
  const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
  
  // Get center before scaling
  const center = box.getCenter(new THREE.Vector3());
  
  // Center the model first (move to origin)
  clonedObj.position.sub(center);
  
  // Then apply scale
  clonedObj.scale.set(scale, scale, scale);
  
  // Recalculate bounding box after scaling to ensure proper centering
  const newBox = new THREE.Box3().setFromObject(clonedObj);
  const newCenter = newBox.getCenter(new THREE.Vector3());
  
  // Adjust position to ensure it's centered at origin
  if (newCenter.length() > 0.001) {
    clonedObj.position.sub(newCenter);
  }
  
  // Store the processed geometry
  drumKitModelCache.set('processed', clonedObj);
  
  return clonedObj;
};

// Process and cache keyboard model geometry (only once)
const processKeyboardModel = (obj) => {
  // Clear cache to force reprocessing with new size
  if (keyboardModelCache.has('processed')) {
    keyboardModelCache.delete('processed');
  }
  
  // Clone the object to avoid mutating the original
  const clonedObj = obj.clone();
  
  // Reset position and rotation to ensure clean state
  clonedObj.position.set(0, 0, 0);
  clonedObj.rotation.set(0, 0, 0);
  clonedObj.scale.set(1, 1, 1);
  
  // Calculate bounding box to determine scale
  const box = new THREE.Box3().setFromObject(clonedObj);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  // Scale to fit approximately 1.0 units max dimension
  const targetSize = 1.5;
  const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
  
  // Get center before scaling
  const center = box.getCenter(new THREE.Vector3());
  
  // Center the model first (move to origin)
  clonedObj.position.sub(center);
  
  // Then apply scale
  clonedObj.scale.set(scale, scale, scale);
  
  // Recalculate bounding box after scaling to ensure proper centering
  const newBox = new THREE.Box3().setFromObject(clonedObj);
  const newCenter = newBox.getCenter(new THREE.Vector3());
  
  // Adjust position to ensure it's centered at origin
  if (newCenter.length() > 0.001) {
    clonedObj.position.sub(newCenter);
  }
  
  // Store the processed geometry
  keyboardModelCache.set('processed', clonedObj);
  
  return clonedObj;
};

// Process and cache microphone model geometry (only once)
const processMicrophoneModel = (obj) => {
  // Clear cache to force reprocessing with new size
  if (microphoneModelCache.has('processed')) {
    microphoneModelCache.delete('processed');
  }
  
  // Clone the object to avoid mutating the original
  const clonedObj = obj.clone();
  
  // Reset position and rotation to ensure clean state
  clonedObj.position.set(0, 0, 0);
  clonedObj.rotation.set(0, 0, 0);
  clonedObj.scale.set(1, 1, 1);
  
  // Calculate bounding box to determine scale
  const box = new THREE.Box3().setFromObject(clonedObj);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  // Scale to fit approximately 3.0 units max dimension (much larger for visibility)
  const targetSize = 0.5;
  const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
  
  // Get center before scaling
  const center = box.getCenter(new THREE.Vector3());
  
  // Center the model first (move to origin)
  clonedObj.position.sub(center);
  
  // Then apply scale
  clonedObj.scale.set(1.0, 1.0, 1.0);
  
  // Recalculate bounding box after scaling to ensure proper centering
  const newBox = new THREE.Box3().setFromObject(clonedObj);
  const newCenter = newBox.getCenter(new THREE.Vector3());
  
  // Adjust position to ensure it's centered at origin
  if (newCenter.length() > 0.001) {
    clonedObj.position.sub(newCenter);
  }
  
  // Store the processed geometry
  microphoneModelCache.set('processed', clonedObj);
  
  return clonedObj;
};

// Process and cache electric guitar model geometry (only once)
const processElectricGuitarModel = (obj) => {
  // Clear cache to force reprocessing with new size
  if (electricGuitarModelCache.has('processed')) {
    electricGuitarModelCache.delete('processed');
  }
  
  // Clone the object to avoid mutating the original
  const clonedObj = obj.clone();
  
  // Reset position and rotation to ensure clean state
  clonedObj.position.set(0, 0, 0);
  clonedObj.rotation.set(0, 0, 0);
  clonedObj.scale.set(1, 1, 1);
  
  // Calculate bounding box to determine scale
  const box = new THREE.Box3().setFromObject(clonedObj);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  // Scale to fit approximately 1.2 units max dimension
  const targetSize = 1.2;
  const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
  
  // Get center before scaling
  const center = box.getCenter(new THREE.Vector3());
  
  // Center the model first (move to origin)
  clonedObj.position.sub(center);
  
  // Then apply scale
  clonedObj.scale.set(scale, scale, scale);
  
  // Recalculate bounding box after scaling to ensure proper centering
  const newBox = new THREE.Box3().setFromObject(clonedObj);
  const newCenter = newBox.getCenter(new THREE.Vector3());
  
  // Adjust position to ensure it's centered at origin
  if (newCenter.length() > 0.001) {
    clonedObj.position.sub(newCenter);
  }
  
  // Store the processed geometry
  electricGuitarModelCache.set('processed', clonedObj);
  
  return clonedObj;
};

// Process and cache bass guitar model geometry (only once)
const processBassGuitarModel = (obj) => {
  // Clear cache to force reprocessing with new size
  if (bassGuitarModelCache.has('processed')) {
    bassGuitarModelCache.delete('processed');
  }
  
  // Clone the object to avoid mutating the original
  const clonedObj = obj.clone();
  
  // Reset position and rotation to ensure clean state
  clonedObj.position.set(0, 0, 0);
  clonedObj.rotation.set(Math.PI / 2, 0, 0);
  clonedObj.scale.set(1, 1, 1);
  
  // Calculate bounding box to determine scale
  const box = new THREE.Box3().setFromObject(clonedObj);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  // Scale to fit approximately 1.2 units max dimension
  const targetSize = 1.2;
  const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
  
  // Get center before scaling
  const center = box.getCenter(new THREE.Vector3());
  
  // Center the model first (move to origin)
  clonedObj.position.sub(center);
  
  // Then apply scale
  clonedObj.scale.set(scale, scale, scale);
  
  // Recalculate bounding box after scaling to ensure proper centering
  const newBox = new THREE.Box3().setFromObject(clonedObj);
  const newCenter = newBox.getCenter(new THREE.Vector3());
  
  // Adjust position to ensure it's centered at origin
  if (newCenter.length() > 0.001) {
    clonedObj.position.sub(newCenter);
  }
  
  // Store the processed geometry
  bassGuitarModelCache.set('processed', clonedObj);
  
  return clonedObj;
};

// Amplifier 3D Model Component
const AmplifierModel = ({ color }) => {
  const obj = useLoader(OBJLoader, "/3dmodels/Guitar Amplifier.obj");
  const groupRef = useRef();
  const instanceRef = useRef();
  const materialsRef = useRef([]);
  
  // Process model only once when loaded
  const processedModel = useMemo(() => {
    if (obj) {
      return processAmplifierModel(obj);
    }
    return null;
  }, [obj]);
  
  // Initialize model once
  useEffect(() => {
    if (processedModel && groupRef.current && !instanceRef.current) {
      // Clone the processed model for this instance
      const instance = processedModel.clone();
      instanceRef.current = instance;
      
      // Store materials and apply initial settings
      instance.traverse((child) => {
        if (child.isMesh) {
          const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.7,
          });
          child.material = material;
          materialsRef.current.push(material);
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      groupRef.current.add(instance);
    }
  }, [processedModel]); // Only depend on processedModel, not color
  
  // Update material color when it changes (without recreating the model)
  useEffect(() => {
    if (materialsRef.current.length > 0 && instanceRef.current) {
      materialsRef.current.forEach(material => {
        material.color.set(color);
      });
    }
  }, [color]);
  
  return <group ref={groupRef} />;
};

// Drum Kit 3D Model Component
const DrumKitModel = ({ color }) => {
  const obj = useLoader(OBJLoader, "/3dmodels/Drum%20Kit.obj");
  const groupRef = useRef();
  const instanceRef = useRef();
  const materialsRef = useRef([]);
  
  // Process model only once when loaded
  const processedModel = useMemo(() => {
    if (obj) {
      try {
        return processDrumKitModel(obj);
      } catch (error) {
        console.error("Error processing drum kit model:", error);
        return null;
      }
    }
    return null;
  }, [obj]);
  
  // Initialize model once
  useEffect(() => {
    if (processedModel && groupRef.current && !instanceRef.current) {
      try {
        // Clone the processed model for this instance
        const instance = processedModel.clone();
        instanceRef.current = instance;
        
        // Ensure the instance is at origin (should already be from processing)
        instance.position.set(0, 0, 0);
        instance.rotation.set(0, 0, 0);
        // Don't reset scale - it's already applied in processing!
        
        // Store materials and apply initial settings
        let meshCount = 0;
        instance.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            const material = new THREE.MeshStandardMaterial({
              color: color,
              metalness: 0.3,
              roughness: 0.7,
            });
            child.material = material;
            materialsRef.current.push(material);
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        if (meshCount === 0) {
          console.warn("Drum kit model has no meshes");
        }
        
        groupRef.current.add(instance);
      } catch (error) {
        console.error("Error initializing drum kit model:", error);
      }
    }
  }, [processedModel, color]); // Include color in dependencies for initial setup
  
  // Update material color when it changes (without recreating the model)
  useEffect(() => {
    if (materialsRef.current.length > 0 && instanceRef.current) {
      materialsRef.current.forEach(material => {
        material.color.set(color);
      });
    }
  }, [color]);
  
  return <group ref={groupRef} />;
};

// Keyboard 3D Model Component
const KeyboardModel = ({ color }) => {
  const obj = useLoader(OBJLoader, "/3dmodels/Keyboard.obj");
  const groupRef = useRef();
  const instanceRef = useRef();
  const materialsRef = useRef([]);
  
  // Process model only once when loaded
  const processedModel = useMemo(() => {
    if (obj) {
      try {
        return processKeyboardModel(obj);
      } catch (error) {
        console.error("Error processing keyboard model:", error);
        return null;
      }
    }
    return null;
  }, [obj]);
  
  // Initialize model once
  useEffect(() => {
    if (processedModel && groupRef.current && !instanceRef.current) {
      try {
        // Clone the processed model for this instance
        const instance = processedModel.clone();
        instanceRef.current = instance;
        
        // Ensure the instance is at origin (should already be from processing)
        instance.position.set(0, 0, 0);
        instance.rotation.set(0, 0, 0);
        // Don't reset scale - it's already applied in processing!
        
        // Store materials and apply initial settings
        let meshCount = 0;
        instance.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            const material = new THREE.MeshStandardMaterial({
              color: color,
              metalness: 0.3,
              roughness: 0.7,
            });
            child.material = material;
            materialsRef.current.push(material);
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        if (meshCount === 0) {
          console.warn("Keyboard model has no meshes");
        }
        
        groupRef.current.add(instance);
      } catch (error) {
        console.error("Error initializing keyboard model:", error);
      }
    }
  }, [processedModel, color]); // Include color in dependencies for initial setup
  
  // Update material color when it changes (without recreating the model)
  useEffect(() => {
    if (materialsRef.current.length > 0 && instanceRef.current) {
      materialsRef.current.forEach(material => {
        material.color.set(color);
      });
    }
  }, [color]);
  
  return <group ref={groupRef} />;
};

// Microphone 3D Model Component
const MicrophoneModel = ({ color }) => {
  const obj = useLoader(OBJLoader, "/3dmodels/Microphone.obj");
  const groupRef = useRef();
  const instanceRef = useRef();
  const materialsRef = useRef([]);
  
  // Process model only once when loaded
  const processedModel = useMemo(() => {
    if (obj) {
      try {
        return processMicrophoneModel(obj);
      } catch (error) {
        console.error("Error processing microphone model:", error);
        return null;
      }
    }
    return null;
  }, [obj]);
  
  // Initialize model once
  useEffect(() => {
    if (processedModel && groupRef.current && !instanceRef.current) {
      try {
        // Clone the processed model for this instance
        const instance = processedModel.clone();
        instanceRef.current = instance;
        
        // Ensure the instance is at origin (should already be from processing)
        instance.position.set(0, 0, 0);
        instance.rotation.set(0, 0, 0);
        // Don't reset scale - it's already applied in processing!
        
        // Store materials and apply initial settings
        let meshCount = 0;
        instance.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            const material = new THREE.MeshStandardMaterial({
              color: color,
              metalness: 0.3,
              roughness: 0.7,
            });
            child.material = material;
            materialsRef.current.push(material);
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        if (meshCount === 0) {
          console.warn("Microphone model has no meshes");
        }
        
        groupRef.current.add(instance);
      } catch (error) {
        console.error("Error initializing microphone model:", error);
      }
    }
  }, [processedModel, color]); // Include color in dependencies for initial setup
  
  // Update material color when it changes (without recreating the model)
  useEffect(() => {
    if (materialsRef.current.length > 0 && instanceRef.current) {
      materialsRef.current.forEach(material => {
        material.color.set(color);
      });
    }
  }, [color]);
  
  return <group ref={groupRef} />;
};

// Electric Guitar 3D Model Component
const ElectricGuitarModel = ({ color }) => {
  const obj = useLoader(OBJLoader, "/3dmodels/Electric%20Guitar.obj");
  const groupRef = useRef();
  const instanceRef = useRef();
  const materialsRef = useRef([]);
  
  // Process model only once when loaded
  const processedModel = useMemo(() => {
    if (obj) {
      try {
        return processElectricGuitarModel(obj);
      } catch (error) {
        console.error("Error processing electric guitar model:", error);
        return null;
      }
    }
    return null;
  }, [obj]);
  
  // Initialize model once
  useEffect(() => {
    if (processedModel && groupRef.current && !instanceRef.current) {
      try {
        // Clone the processed model for this instance
        const instance = processedModel.clone();
        instanceRef.current = instance;
        
        // Ensure the instance is at origin (should already be from processing)
        instance.position.set(0, 0, 0);
        instance.rotation.set(0, 0, 0);
        // Don't reset scale - it's already applied in processing!
        
        // Store materials and apply initial settings
        let meshCount = 0;
        instance.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            const material = new THREE.MeshStandardMaterial({
              color: color,
              metalness: 0.3,
              roughness: 0.7,
            });
            child.material = material;
            materialsRef.current.push(material);
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        if (meshCount === 0) {
          console.warn("Electric guitar model has no meshes");
        }
        
        groupRef.current.add(instance);
      } catch (error) {
        console.error("Error initializing electric guitar model:", error);
      }
    }
  }, [processedModel, color]); // Include color in dependencies for initial setup
  
  // Update material color when it changes (without recreating the model)
  useEffect(() => {
    if (materialsRef.current.length > 0 && instanceRef.current) {
      materialsRef.current.forEach(material => {
        material.color.set(color);
      });
    }
  }, [color]);
  
  return <group ref={groupRef} />;
};

// Bass Guitar 3D Model Component
const BassGuitarModel = ({ color }) => {
  const obj = useLoader(OBJLoader, "/3dmodels/Bass%20Guitar.obj");
  const groupRef = useRef();
  const instanceRef = useRef();
  const materialsRef = useRef([]);
  
  // Process model only once when loaded
  const processedModel = useMemo(() => {
    if (obj) {
      try {
        return processBassGuitarModel(obj);
      } catch (error) {
        console.error("Error processing bass guitar model:", error);
        return null;
      }
    }
    return null;
  }, [obj]);
  
  // Initialize model once
  useEffect(() => {
    if (processedModel && groupRef.current && !instanceRef.current) {
      try {
        // Clone the processed model for this instance
        const instance = processedModel.clone();
        instanceRef.current = instance;
        
        // Ensure the instance is at origin (should already be from processing)
        instance.position.set(0, 0, 0);
        instance.rotation.set(0, 0, 0);
        // Don't reset scale - it's already applied in processing!
        
        // Store materials and apply initial settings
        let meshCount = 0;
        instance.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            const material = new THREE.MeshStandardMaterial({
              color: color,
              metalness: 0.3,
              roughness: 0.7,
            });
            child.material = material;
            materialsRef.current.push(material);
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        if (meshCount === 0) {
          console.warn("Bass guitar model has no meshes");
        }
        
        groupRef.current.add(instance);
      } catch (error) {
        console.error("Error initializing bass guitar model:", error);
      }
    }
  }, [processedModel, color]); // Include color in dependencies for initial setup
  
  // Update material color when it changes (without recreating the model)
  useEffect(() => {
    if (materialsRef.current.length > 0 && instanceRef.current) {
      materialsRef.current.forEach(material => {
        material.color.set(color);
      });
    }
  }, [color]);
  
  return <group ref={groupRef} />;
};

// Lightning Bolt 2D Icon Component (flat on stage)
const LightningBolt = ({ color }) => {
  return (
    <Text
      position={[0, 0.01, 0]}
      fontSize={0.5}
      color={color}
      anchorX="center"
      anchorY="middle"
      rotation={[-Math.PI / 2, 0, 0]}
    >
      ⚡
    </Text>
  );
};

// Equipment-specific 3D geometry renderer
const EquipmentGeometry = ({ equipmentId }) => {
  switch (equipmentId) {
    case "vocal-mic":
      return <cylinderGeometry args={[0.3, 0.3, 1.5, 16]} />;
    case "electric-guitar":
    case "acoustic-guitar":
    case "bass-guitar":
      return <boxGeometry args={[1.2, 0.2, 0.05]} />;
    case "keyboard":
      return <boxGeometry args={[1.5, 0.2, 0.4]} />;
    case "di-box":
      return <boxGeometry args={[0.3, 0.2, 0.15]} />;
    case "drum-kit":
      // Return a single geometry for the main drum, child meshes will be added separately
      return <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />;
    default:
      return <boxGeometry args={[0.5, 0.5, 0.5]} />;
  }
};

const getEquipmentColor = (equipmentId) => {
  switch (equipmentId) {
    case "vocal-mic":
      return "#000000"; // Black color for microphone
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
    case "power-connection":
      return "#FFD700"; // Yellow for lightning bolt
    default:
      return "#6F22D2";
  }
};

// Get the Y offset to position equipment so its bottom sits on the stage surface
// Stage surface is at y = STAGE_HEIGHT (0.2)
const getEquipmentYOffset = (equipmentId) => {
  const STAGE_SURFACE_Y = 0.2; // Top of stage edges
  
  switch (equipmentId) {
    case "vocal-mic":
      // Processed model target size: 3.0, centered at origin
      // Calculate based on actual height - approximate as 2.4 units height
      // So bottom is at -1.2, top at +1.2
      // To position bottom at stage surface (0.2), position at 0.2 + 1.2 = 1.4
      return STAGE_SURFACE_Y + 0.1; // Half height above stage surface
    case "electric-guitar":
      // Processed model target size: 1.2, centered at origin
      // Calculate based on actual height - approximate as 0.2 units height
      // So bottom is at -0.1, top at +0.1
      // To position bottom at stage surface (0.2), position at 0.2 + 0.1 = 0.3
      return STAGE_SURFACE_Y + 0.1; // Half height above stage surface
    case "acoustic-guitar":
      // Box height: 0.05 (very thin)
      return STAGE_SURFACE_Y + 0.025; // Half height above stage surface
    case "bass-guitar":
      // Processed model target size: 1.2, centered at origin
      // Calculate based on actual height - approximate as 0.2 units height
      // So bottom is at -0.1, top at +0.1
      // To position bottom at stage surface (0.2), position at 0.2 + 0.1 = 0.3
      return STAGE_SURFACE_Y + 0.6; // Half height above stage surface
    case "guitar-amp":
      return STAGE_SURFACE_Y + 0.9;
    case "bass-amp":
      return STAGE_SURFACE_Y + 0.9;
    case "keyboard-amp":
      // Processed model target height: 1.2, centered at origin
      // So bottom is at -0.6, top at +0.6
      // To position bottom at stage surface (0.2), position at 0.2 + 0.6 = 0.8
      return STAGE_SURFACE_Y + 0.9; // Half height above stage surface
    case "keyboard":
      // Processed model target size: 1.0, centered at origin
      // Calculate based on actual height - approximate as 0.3 units height
      // So bottom is at -0.15, top at +0.15
      // To position bottom at stage surface (0.2), position at 0.2 + 0.15 = 0.35
      return STAGE_SURFACE_Y + 0.15; // Half height above stage surface
    case "di-box":
      // Box height: 0.15
      return STAGE_SURFACE_Y + 0.075; // Half height above stage surface
    case "drum-kit":
      // Processed model target size: 1.44, centered at origin
      // Calculate based on actual height - approximate as 1.08 units height
      // So bottom is at -0.54, top at +0.54
      // To position bottom at stage surface (0.2), position at 0.2 + 0.54 = 0.74
      return STAGE_SURFACE_Y + 1; // Half height above stage surface
    case "power-connection":
      // Flat 2D icon, position just above stage surface
      return STAGE_SURFACE_Y + 0.01;
    default:
      // Default box height: 0.5
      return STAGE_SURFACE_Y + 0.25; // Half height above stage surface
  }
};

// Draggable Equipment Component
const DraggableEquipment = ({ item, onUpdate, onRemove, controlsRef }) => {
  const groupRef = useRef();
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const { raycaster, camera, gl } = useThree();

  const handlePointerDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    gl.domElement.style.cursor = 'grabbing';
    // Disable orbit controls while dragging
    if (controlsRef?.current) {
      controlsRef.current.enabled = false;
    }
  };

  const lastUpdateRef = useRef({ x: null, z: null });
  
  useFrame((state) => {
    if (isDragging && groupRef.current) {
      // Use state.pointer which is already normalized
      const mouse = new THREE.Vector2(state.pointer.x, state.pointer.y);
      raycaster.setFromCamera(mouse, camera);
      
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlane.current, intersection);
      
      if (intersection) {
        const STAGE_WIDTH = 10;
        const STAGE_DEPTH = 6;
        const margin = 0.5;
        
        const newX = Math.max(-STAGE_WIDTH / 2 + margin, Math.min(STAGE_WIDTH / 2 - margin, intersection.x));
        const newZ = Math.max(-STAGE_DEPTH / 2 + margin, Math.min(STAGE_DEPTH / 2 - margin, intersection.z));
        
        // Only update if position changed significantly (reduce unnecessary updates)
        const threshold = 0.05;
        if (
          lastUpdateRef.current.x === null ||
          lastUpdateRef.current.z === null ||
          Math.abs(lastUpdateRef.current.x - newX) > threshold ||
          Math.abs(lastUpdateRef.current.z - newZ) > threshold
        ) {
          lastUpdateRef.current.x = newX;
          lastUpdateRef.current.z = newZ;
          onUpdate(newX, newZ);
        }
      }
    } else {
      // Reset when not dragging
      lastUpdateRef.current.x = null;
      lastUpdateRef.current.z = null;
    }
  });

  useEffect(() => {
    const handlePointerUp = (e) => {
      if (isDragging) {
        setIsDragging(false);
        gl.domElement.style.cursor = 'default';
        // Re-enable orbit controls
        if (controlsRef?.current) {
          controlsRef.current.enabled = true;
        }
        
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
  }, [isDragging, gl, onRemove, controlsRef]);

  const color = hovered || isDragging ? "#6F22D2" : getEquipmentColor(item.id);
  const isAmplifier = item.id === "guitar-amp" || item.id === "bass-amp" || item.id === "keyboard-amp";
  const isDrumKit = item.id === "drum-kit";
  const isKeyboard = item.id === "keyboard";
  const isMicrophone = item.id === "vocal-mic";
  const isElectricGuitar = item.id === "electric-guitar";
  const isBassGuitar = item.id === "bass-guitar";
  const isPowerConnection = item.id === "power-connection";
  const yOffset = getEquipmentYOffset(item.id);

  return (
    <group ref={groupRef} position={[item.x, yOffset, item.z]}>
      {isDrumKit ? (
        <Suspense fallback={
          <group
            ref={meshRef}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={handlePointerDown}
          >
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
              <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
            </mesh>
            <mesh position={[0.5, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
              <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
            </mesh>
            <mesh position={[-0.5, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
              <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
            </mesh>
          </group>
        }>
          <group
            ref={meshRef}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHovered(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e);
            }}
          >
            <DrumKitModel color={color} />
          </group>
        </Suspense>
      ) : isAmplifier ? (
        <Suspense fallback={
          <mesh 
            ref={meshRef}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={handlePointerDown}
            castShadow 
            receiveShadow
          >
            <boxGeometry args={[0.8, 1.2, 0.6]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
          </mesh>
        }>
          <group
            ref={meshRef}
            rotation={[0, -Math.PI / 2, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHovered(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e);
            }}
          >
            <AmplifierModel color={color} />
          </group>
        </Suspense>
      ) : isKeyboard ? (
        <Suspense fallback={
          <mesh 
            ref={meshRef}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={handlePointerDown}
            castShadow 
            receiveShadow
          >
            <boxGeometry args={[1.5, 0.2, 0.4]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
          </mesh>
        }>
          <group
            ref={meshRef}
            rotation={[0, Math.PI / 2, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHovered(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e);
            }}
          >
            <KeyboardModel color={color} />
          </group>
        </Suspense>
      ) : isMicrophone ? (
        <Suspense fallback={
          <mesh 
            ref={meshRef}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={handlePointerDown}
            castShadow 
            receiveShadow
          >
            <cylinderGeometry args={[0.3, 0.3, 1.5, 16]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
          </mesh>
        }>
          <group
            ref={meshRef}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHovered(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e);
            }}
          >
            <MicrophoneModel color={color} />
          </group>
        </Suspense>
      ) : isElectricGuitar ? (
        <Suspense fallback={
          <mesh 
            ref={meshRef}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={handlePointerDown}
            castShadow 
            receiveShadow
          >
            <boxGeometry args={[1.2, 0.2, 0.05]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
          </mesh>
        }>
          <group
            ref={meshRef}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHovered(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e);
            }}
          >
            <ElectricGuitarModel color={color} />
          </group>
        </Suspense>
      ) : isBassGuitar ? (
        <Suspense fallback={
          <mesh 
            ref={meshRef}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={handlePointerDown}
            castShadow 
            receiveShadow
          >
            <boxGeometry args={[1.2, 0.2, 0.05]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
          </mesh>
        }>
          <group
            ref={meshRef}
            rotation={[Math.PI / 2, 0, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHovered(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e);
            }}
          >
            <BassGuitarModel color={color} />
          </group>
        </Suspense>
      ) : isPowerConnection ? (
        <group
          ref={meshRef}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePointerDown(e);
          }}
        >
          <LightningBolt color={color} />
        </group>
      ) : (
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
      )}
      
      {/* Label above equipment (skip for power connections) */}
      {!isPowerConnection && (
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
      )}
    </group>
  );
};

// 3D Stage Component
const Stage3D = ({ stageItems, onItemUpdate, onItemRemove, draggedItem, onDrop, controlsRef }) => {
  const stageRef = useRef();
  const stageFloorRef = useRef();
  const [hovered, setHovered] = useState(false);
  const { raycaster, camera, gl } = useThree();

  // Stage dimensions (in 3D units)
  const STAGE_WIDTH = 10;
  const STAGE_DEPTH = 6;
  const STAGE_HEIGHT = 0.2;

  const handleStagePointerMove = (e) => {
    if (draggedItem) {
      // Could add visual feedback here (highlight drop position)
    }
  };

  const handleStageClick = (e) => {
    if (draggedItem && onDrop) {
      e.stopPropagation();
      const intersection = e.intersections.find(i => i.object === stageFloorRef.current);
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
        ref={stageFloorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerMove={handleStagePointerMove}
        onClick={handleStageClick}
      >
        <planeGeometry args={[STAGE_WIDTH, STAGE_DEPTH]} />
        <meshStandardMaterial
          color={hovered || draggedItem ? "#2F3843" : "#1F2833"}
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
          controlsRef={controlsRef}
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
  const controlsRef = useRef();
  const canvasContainerRef = useRef();
  const [isDraggingOverCanvas, setIsDraggingOverCanvas] = useState(false);

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
    { id: "drum-kit", name: "Drum Kit", icon: "🥁" },
    { id: "power-connection", name: "Power Connection", icon: "⚡" }
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
    // Store equipment data in dataTransfer for drop handling
    e.dataTransfer.setData("text/plain", equipment.id);
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOverCanvas(true);
  };

  const handleCanvasDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverCanvas(false);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverCanvas(false);
    
    // Don't place immediately - wait for user to click on stage
    // The draggedItem is already set, so clicking the stage will place it
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
        <div 
          ref={canvasContainerRef}
          className={`editor-canvas-3d ${isDraggingOverCanvas ? 'dragging-over' : ''}`}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
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
              ref={controlsRef}
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
              controlsRef={controlsRef}
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
            {draggedItem && (
              <p className="drop-hint">📍 Click on stage to place {draggedItem.name}</p>
            )}
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
