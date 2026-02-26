import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Declare global MediaPipe types since we are loading from CDN
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

export default function GesturePlanet() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Initializing Camera & Hand Tracking...");

  useEffect(() => {
    if (!containerRef.current || !videoRef.current) return;

    // --- THREE.JS SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    // Add some fog for depth
    scene.fog = new THREE.FogExp2(0x000000, 0.002);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Initial camera position
    let cameraRadius = 20;
    let cameraTheta = 0; // Horizontal angle
    let cameraPhi = Math.PI / 2; // Vertical angle (keep mostly centered)
    
    camera.position.z = cameraRadius;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // --- PLANET CREATION ---
    // Brilliant Orange Planet
    const planetGeometry = new THREE.BufferGeometry();
    const planetParticleCount = 15000;
    const planetPositions = new Float32Array(planetParticleCount * 3);
    const planetColors = new Float32Array(planetParticleCount * 3);
    const planetSizes = new Float32Array(planetParticleCount);

    const colorInside = new THREE.Color(0xff4500); // OrangeRed
    const colorSurface = new THREE.Color(0xffa500); // Orange

    for (let i = 0; i < planetParticleCount; i++) {
      // Distribute particles: More on surface, some inside
      const radius = 5;
      // Random point in sphere
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      
      // Bias towards surface: r = radius * (random ^ 0.1) pushes points out
      // Or just mix surface and volume
      let r = radius * Math.cbrt(Math.random()); 
      if (Math.random() > 0.3) {
        // 70% chance to be exactly on/near surface
        r = radius * (0.95 + Math.random() * 0.1);
      }

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      planetPositions[i * 3] = x;
      planetPositions[i * 3 + 1] = y;
      planetPositions[i * 3 + 2] = z;

      // Color based on radius (brighter on surface)
      const mixedColor = colorInside.clone().lerp(colorSurface, (r / radius));
      planetColors[i * 3] = mixedColor.r;
      planetColors[i * 3 + 1] = mixedColor.g;
      planetColors[i * 3 + 2] = mixedColor.b;

      // Size variation
      planetSizes[i] = Math.random() * 0.2 + 0.1;
    }

    planetGeometry.setAttribute('position', new THREE.BufferAttribute(planetPositions, 3));
    planetGeometry.setAttribute('color', new THREE.BufferAttribute(planetColors, 3));
    planetGeometry.setAttribute('size', new THREE.BufferAttribute(planetSizes, 1));

    // Custom shader for particles to make them round and glowing
    const particleVertexShader = `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const particleFragmentShader = `
      varying vec3 vColor;
      void main() {
        // Circular particle
        vec2 coord = gl_PointCoord - vec2(0.5);
        if(length(coord) > 0.5) discard;
        
        // Soft glow edge
        float strength = 1.0 - (length(coord) * 2.0);
        strength = pow(strength, 1.5); // Sharpen slightly
        
        gl_FragColor = vec4(vColor, strength); // Additive blending uses alpha effectively
      }
    `;

    const planetMaterial = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
      vertexColors: true
    });

    const planet = new THREE.Points(planetGeometry, planetMaterial);
    scene.add(planet);

    // --- RINGS CREATION ---
    const ringsGeometry = new THREE.BufferGeometry();
    const ringsParticleCount = 8000;
    const ringsPositions = new Float32Array(ringsParticleCount * 3);
    const ringsColors = new Float32Array(ringsParticleCount * 3);
    const ringsSizes = new Float32Array(ringsParticleCount);

    for (let i = 0; i < ringsParticleCount; i++) {
      // Two rings: Inner (7-10), Outer (11-14)
      let r;
      if (Math.random() > 0.5) {
        r = 7 + Math.random() * 3;
      } else {
        r = 11 + Math.random() * 3;
      }

      const angle = Math.random() * Math.PI * 2;
      // Flattened disk
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle); // Rings in XZ plane initially
      const y = (Math.random() - 0.5) * 0.5; // Slight thickness

      ringsPositions[i * 3] = x;
      ringsPositions[i * 3 + 1] = y;
      ringsPositions[i * 3 + 2] = z;

      // White color
      ringsColors[i * 3] = 1.0;
      ringsColors[i * 3 + 1] = 1.0;
      ringsColors[i * 3 + 2] = 1.0;

      ringsSizes[i] = Math.random() * 0.15 + 0.05;
    }

    ringsGeometry.setAttribute('position', new THREE.BufferAttribute(ringsPositions, 3));
    ringsGeometry.setAttribute('color', new THREE.BufferAttribute(ringsColors, 3));
    ringsGeometry.setAttribute('size', new THREE.BufferAttribute(ringsSizes, 1));

    const ringsMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
      vertexColors: true
    });

    const rings = new THREE.Points(ringsGeometry, ringsMaterial);
    // Tilt the rings a bit
    rings.rotation.x = Math.PI / 6;
    rings.rotation.z = Math.PI / 8;
    scene.add(rings);


    // --- ANIMATION LOOP ---
    let targetCameraRadius = 20;
    let targetCameraTheta = 0;
    
    // Smooth dampening variables
    let currentRadius = 20;
    let currentTheta = 0;

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();

      // Rotate planet and rings slowly automatically
      planet.rotation.y += 0.05 * delta;
      rings.rotation.y -= 0.02 * delta;

      // Smooth camera movement
      // Lerp current values to target values
      currentRadius += (targetCameraRadius - currentRadius) * 2.0 * delta;
      
      // Handle theta wrapping for smooth rotation
      // Minimal distance logic for theta
      let diff = targetCameraTheta - currentTheta;
      // Normalize to -PI to PI
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      currentTheta += diff * 5.0 * delta; // Rotate faster than zoom

      // Update Camera Position
      // Convert Spherical (Radius, Theta, Phi) to Cartesian (X, Y, Z)
      // Y is up in Three.js usually.
      // x = r * sin(phi) * sin(theta)
      // y = r * cos(phi)
      // z = r * sin(phi) * cos(theta)
      
      camera.position.x = currentRadius * Math.sin(cameraPhi) * Math.sin(currentTheta);
      camera.position.y = currentRadius * Math.cos(cameraPhi);
      camera.position.z = currentRadius * Math.sin(cameraPhi) * Math.cos(currentTheta);

      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    // --- MEDIAPIPE HANDS SETUP ---
    const onResults = (results: any) => {
      setLoading(false);
      setStatus("Tracking Active");
      
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // 1. ROTATION CONTROL
        // Use Wrist (0) and Middle Finger MCP (9) to determine hand angle
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];
        
        // Calculate vector in 2D (screen space)
        // MediaPipe x is 0-1 (left-right), y is 0-1 (top-bottom)
        // We want angle relative to vertical up
        const dx = middleMCP.x - wrist.x;
        const dy = middleMCP.y - wrist.y; // Y increases downwards in screen coords
        
        // Calculate angle. 
        // If hand is upright (fingers up), dy is negative (0.4 - 0.6 = -0.2).
        // atan2(dy, dx)
        // Up (-y) -> -PI/2
        // Right (+x) -> 0
        // Left (-x) -> PI or -PI
        // Down (+y) -> PI/2
        
        // We want to map hand rotation to camera rotation.
        // Let's use the angle directly.
        // Offset so upright is 0.
        const angle = Math.atan2(dy, dx);
        // Map to rotation. 
        // Let's say upright (-PI/2) is 0 rotation offset.
        // But we want "rotate hand" -> "camera rotates".
        // Let's just map the angle directly to targetTheta with a factor.
        // Or better: Use the change in angle to drive rotation speed?
        // The prompt says: "User rotates hand... camera rotates... like planet rotating synchronously"
        // This implies direct mapping: Hand Angle = Camera Angle.
        
        // Adjust angle so 0 is "up".
        // atan2(-1, 0) = -PI/2.
        const handAngle = angle + Math.PI / 2; 
        // Now Up is 0. Right is PI/2. Left is -PI/2.
        
        // Update target theta. Invert if necessary to match "clockwise/counter-clockwise"
        targetCameraTheta = -handAngle * 2.0; // Multiplier for sensitivity


        // 2. ZOOM CONTROL
        // Detect Fist vs Open Hand
        // Simple heuristic: Check if fingertips are close to wrist or MCPs
        // Tips: 4, 8, 12, 16, 20
        // MCPs: 2, 5, 9, 13, 17
        // Wrist: 0
        
        // Calculate average distance of fingertips to wrist
        const tips = [8, 12, 16, 20]; // Exclude thumb for simpler logic
        let avgDist = 0;
        for (let i of tips) {
            const d = Math.sqrt(
                Math.pow(landmarks[i].x - landmarks[0].x, 2) + 
                Math.pow(landmarks[i].y - landmarks[0].y, 2)
            );
            avgDist += d;
        }
        avgDist /= tips.length;

        // Threshold for Fist vs Open
        // This threshold depends on hand distance (scale), so we should normalize by hand size (e.g. Wrist to Middle MCP)
        const handSize = Math.sqrt(
            Math.pow(middleMCP.x - wrist.x, 2) + 
            Math.pow(middleMCP.y - wrist.y, 2)
        );
        
        const isOpen = avgDist > handSize * 1.5; // Heuristic
        const isFist = avgDist < handSize * 1.0;

        // 3. ZOOM DYNAMICS
        // "Fist + Pull away -> Zoom out (slow then fast)"
        // "Open + Push in -> Zoom in (fast then slow)"
        
        // Use handSize as proxy for distance.
        // handSize is large -> Close to camera
        // handSize is small -> Far from camera
        
        // Model: CameraRadius = K / handSize
        // Let's tune K.
        // Typical handSize (screen normalized): 0.1 (far) to 0.4 (close)
        // Desired Radius: 10 (close) to 60 (far)
        
        // If handSize = 0.1 -> Radius = 60 -> K = 6
        // If handSize = 0.4 -> Radius = 15 -> K = 6
        // So R = 6 / handSize seems like a good starting point.
        
        const K = 4.0; 
        // Constrain handSize to avoid infinity
        const safeHandSize = Math.max(0.05, Math.min(handSize, 0.8));
        
        let targetR = K / safeHandSize;
        
        // Apply constraints
        const minRadius = 8; // "Minimum distance constraint"
        const maxRadius = 100;
        
        if (targetR < minRadius) targetR = minRadius;
        if (targetR > maxRadius) targetR = maxRadius;

        // Apply logic based on gesture
        if (isFist) {
            // "Fist and pull away"
            // If user is making a fist, we allow zooming OUT.
            // If they move hand away (handSize shrinks), targetR increases.
            // The formula R = K/size naturally provides "Slow then Fast" behavior for moving away.
            // (d(1/x)/dx = -1/x^2, slope increases as x decreases)
            targetCameraRadius = targetR;
        } else if (isOpen) {
            // "Open and push in"
            // If user is opening hand, we allow zooming IN.
            // If they move hand closer (handSize grows), targetR decreases.
            // The formula R = K/size naturally provides "Fast then Slow" behavior for moving closer.
            // (Slope decreases as x increases)
            targetCameraRadius = targetR;
        }
        // If neither (transition state), maybe just hold or drift? 
        // Let's just track continuously for smoothness, but maybe bias slightly?
        // The prompt implies specific gestures trigger the zoom.
        // But continuous tracking is usually better UX. 
        // Let's strictly follow: 
        // "When fist... camera moves away"
        // "When open... camera moves closer"
        // This might imply that if I make a fist and move closer, nothing happens?
        // Or if I open hand and move away, nothing happens?
        // Let's implement a "Latch" logic or just use the continuous mapping but gated by state.
        
        if (isFist) {
             // Only allow radius to increase? Or just follow the hand?
             // "When fist and pull away" -> implies active action.
             // Let's just follow the mapping if Fist.
             targetCameraRadius = targetR;
        } else if (isOpen) {
             // Follow mapping if Open.
             targetCameraRadius = targetR;
        }
        // If ambiguous state, keep previous targetCameraRadius (don't update)
      }
    };

    // Initialize MediaPipe Hands
    const hands = new window.Hands({locateFile: (file: string) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});
    
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    hands.onResults(onResults);

    // Initialize Camera
    const cameraUtils = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
            await hands.send({image: videoRef.current});
        }
      },
      width: 640,
      height: 480
    });
    
    cameraUtils.start()
      .then(() => {
          console.log("Camera started");
      })
      .catch((err: any) => {
          console.error("Camera error", err);
          setStatus("Camera Error: " + err.message);
      });


    // Cleanup
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      // Clean up Three.js
      if (containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      // Stop camera? MediaPipe camera utils doesn't have a clean stop method exposed easily on the instance type usually, 
      // but we can just unmount.
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Container */}
      <div ref={containerRef} className="absolute inset-0 z-10" />
      
      {/* Hidden Video Element for MediaPipe */}
      <video ref={videoRef} className="hidden" playsInline muted />
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-20 text-white font-mono pointer-events-none">
        <h1 className="text-xl font-bold text-orange-500">Gesture Planet</h1>
        <p className="text-sm opacity-70 mt-1">{status}</p>
        {loading && <p className="text-xs text-orange-300 mt-2 animate-pulse">Please allow camera access...</p>}
        
        <div className="mt-4 text-xs opacity-50 space-y-1">
          <p>Controls:</p>
          <p>• Rotate Hand ➜ Rotate View</p>
          <p>• Fist + Pull Away ➜ Zoom Out</p>
          <p>• Open Hand + Push In ➜ Zoom In</p>
        </div>
      </div>
    </div>
  );
}
