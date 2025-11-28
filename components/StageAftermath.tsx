import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface StageAftermathProps {
    onRestart: () => void;
    mixedColors: string[];
    ingredients: string[];
    videoStream: MediaStream | null;
}

interface Comment {
    id: number;
    user: string;
    text: string;
    avatar: string;
    color: string;
}

// --- CONSTANTS & TYPES ---
const MODES = ['CHAOS', 'FLOOR', 'CLUSTERS', 'HEART', 'GIO'] as const;
type VisualMode = typeof MODES[number];

const PARTICLE_COUNT = 3000;

// --- SHADERS ---
// Gives particles a "wet", solid, somewhat glowing food-chunk look
const particleVertexShader = `
  attribute float size;
  attribute vec3 customColor;
  varying vec3 vColor;
  void main() {
    vColor = customColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Scale by distance, but keep a minimum size for visibility
    gl_PointSize = size * (400.0 / -mvPosition.z); 
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    // Diffuse shading (sphere look)
    float diffuse = sqrt(1.0 - dist*dist*4.0);
    
    // Specular highlight (wetness / oily)
    vec2 lightPos = vec2(-0.15, -0.15);
    float spec = 0.0;
    // Sharper highlight for "oily" feel
    if (distance(coord, lightPos) < 0.12) {
        spec = 0.7;
    }

    // Rim lighting (Cosmic/Volume feel)
    float rim = smoothstep(0.35, 0.5, dist) * 0.4;

    // Base color + highlights
    vec3 finalColor = vColor * (0.3 + diffuse * 0.7) + vec3(spec) + vec3(rim * 0.5, rim * 0.2, 0.0);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const StageAftermath: React.FC<StageAftermathProps> = ({ onRestart, mixedColors, ingredients, videoStream }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [mode, setMode] = useState<VisualMode>('CHAOS');
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState(12400);

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  
  // Physics Refs for Morphing
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const targetPositionsRef = useRef<Record<VisualMode, Float32Array> | null>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  
  // Interaction Refs
  const mouseRef = useRef({ x: 0, y: 0 }); // Normalized -1 to 1
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseVectorRef = useRef(new THREE.Vector3());
  
  const frameIdRef = useRef<number>(0);
  const timeRef = useRef(0);

  // --- 1. SHAPE GENERATORS ---
  const generateShapes = (width: number, height: number) => {
      const targets: Record<VisualMode, Float32Array> = {
          CHAOS: new Float32Array(PARTICLE_COUNT * 3),
          FLOOR: new Float32Array(PARTICLE_COUNT * 3),
          CLUSTERS: new Float32Array(PARTICLE_COUNT * 3),
          HEART: new Float32Array(PARTICLE_COUNT * 3),
          GIO: new Float32Array(PARTICLE_COUNT * 3),
      };

      // Helper: Random Point in Sphere
      const randomSphere = (radius: number) => {
          const u = Math.random();
          const v = Math.random();
          const theta = 2 * Math.PI * u;
          const phi = Math.acos(2 * v - 1);
          const r = Math.cbrt(Math.random()) * radius;
          return {
              x: r * Math.sin(phi) * Math.cos(theta),
              y: r * Math.sin(phi) * Math.sin(theta),
              z: r * Math.cos(phi)
          };
      };

      // A. CHAOS (Explosion / Universe)
      for(let i=0; i<PARTICLE_COUNT; i++) {
          const p = randomSphere(500); // Large spread
          targets.CHAOS[i*3] = p.x;
          targets.CHAOS[i*3+1] = p.y;
          targets.CHAOS[i*3+2] = p.z;
      }

      // B. FLOOR (Scattered Debris)
      for(let i=0; i<PARTICLE_COUNT; i++) {
          // Spread on XZ plane, fixed Y
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 400; // Disc
          targets.FLOOR[i*3] = Math.cos(angle) * r;
          targets.FLOOR[i*3+1] = -200 + (Math.random() * 20); // Floor level with slight pile
          targets.FLOOR[i*3+2] = Math.sin(angle) * r;
      }

      // C. CLUSTERS (30 Groups)
      const centers: {x:number, y:number, z:number}[] = [];
      for(let c=0; c<30; c++) {
          centers.push(randomSphere(250));
      }
      for(let i=0; i<PARTICLE_COUNT; i++) {
          const center = centers[i % 30];
          // Gaussian puff around center
          const puff = randomSphere(30);
          targets.CLUSTERS[i*3] = center.x + puff.x;
          targets.CLUSTERS[i*3+1] = center.y + puff.y;
          targets.CLUSTERS[i*3+2] = center.z + puff.z;
      }

      // D. HEART (Descartes/Parametric)
      for(let i=0; i<PARTICLE_COUNT; i++) {
          const t = Math.random() * Math.PI * 2;
          const scale = 12;
          const x = 16 * Math.pow(Math.sin(t), 3);
          const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
          
          const thickness = 5 + Math.random() * 5;
          
          targets.HEART[i*3] = x * scale + (Math.random()-0.5)*thickness;
          targets.HEART[i*3+1] = y * scale + (Math.random()-0.5)*thickness + 50; 
          targets.HEART[i*3+2] = (Math.random()-0.5) * 40; 
      }

      // E. GIO (Text Sampling)
      const txtCanvas = document.createElement('canvas');
      txtCanvas.width = 200;
      txtCanvas.height = 100;
      const ctx = txtCanvas.getContext('2d');
      if (ctx) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0,0,200,100);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 80px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('GIO', 100, 50);
          
          const imgData = ctx.getImageData(0,0,200,100);
          const validPixels: number[] = [];
          for(let j=0; j<imgData.data.length; j+=4) {
              if (imgData.data[j] > 100) validPixels.push(j/4); 
          }

          for(let i=0; i<PARTICLE_COUNT; i++) {
              if (validPixels.length > 0) {
                  const pxIndex = validPixels[i % validPixels.length]; 
                  const pxX = pxIndex % 200;
                  const pxY = Math.floor(pxIndex / 200);
                  
                  targets.GIO[i*3] = (pxX - 100) * 4 + (Math.random()-0.5)*8;
                  targets.GIO[i*3+1] = -(pxY - 50) * 4 + (Math.random()-0.5)*8;
                  targets.GIO[i*3+2] = (Math.random()-0.5) * 30;
              } else {
                   targets.GIO[i*3] = 0; targets.GIO[i*3+1] = 0; targets.GIO[i*3+2] = 0;
              }
          }
      }

      return targets;
  };

  // --- 2. INIT SCENE ---
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // A. Setup Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); // Deep space black
    
    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.z = 500;
    camera.position.y = 50;

    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current, 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // B. Generate Shapes & Buffers
    const targets = generateShapes(width, height);
    targetPositionsRef.current = targets;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const vels = new Float32Array(PARTICLE_COUNT * 3); // Velocity

    // Init Particles
    const colorObj = new THREE.Color();
    for(let i=0; i<PARTICLE_COUNT; i++) {
        // Start at CHAOS
        positions[i*3] = targets.CHAOS[i*3];
        positions[i*3+1] = targets.CHAOS[i*3+1];
        positions[i*3+2] = targets.CHAOS[i*3+2];

        // Colors - use mixing logic
        let hex = '#fbbf24';
        if (mixedColors.length > 0) hex = mixedColors[i % mixedColors.length];
        else hex = i % 2 === 0 ? '#ef4444' : '#fbbf24'; 
        
        colorObj.set(hex);
        // Random variation for "messy food" look
        colorObj.offsetHSL(0, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.2);

        colors[i*3] = colorObj.r;
        colors[i*3+1] = colorObj.g;
        colors[i*3+2] = colorObj.b;

        // Varied chunk sizes
        sizes[i] = 5 + Math.random() * 25; 
    }

    currentPositionsRef.current = positions;
    velocitiesRef.current = vels;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        blending: THREE.NormalBlending, // Solid chunks
        depthTest: true,
        depthWrite: false,
        transparent: true
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    particlesRef.current = points;

    // C. Refs Assignment
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
    };
  }, [mixedColors]);

  // --- 3. ANIMATION LOOP ---
  useEffect(() => {
    const loop = () => {
        if (!particlesRef.current || !targetPositionsRef.current || !currentPositionsRef.current || !velocitiesRef.current) return;

        timeRef.current += 0.01;
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const target = targetPositionsRef.current[mode];
        const vels = velocitiesRef.current;
        const camera = cameraRef.current;

        // Camera Orbit
        if (camera) {
            const r = 550;
            const speed = 0.2;
            const targetX = r * Math.cos(timeRef.current * speed + mouseRef.current.x * 0.5);
            const targetZ = r * Math.sin(timeRef.current * speed + mouseRef.current.x * 0.5);
            
            // Smooth lerp camera
            camera.position.x += (targetX - camera.position.x) * 0.05;
            camera.position.z += (targetZ - camera.position.z) * 0.05;
            camera.lookAt(0, 0, 0);
        }

        // --- Interaction: Project Mouse to 3D Space ---
        // We define a point in 3D space corresponding to the mouse cursor on the Z=0 plane (or average particle plane)
        let mouseWorld = new THREE.Vector3(0,0,0);
        if (camera) {
            mouseVectorRef.current.set(mouseRef.current.x, mouseRef.current.y, 0.5);
            mouseVectorRef.current.unproject(camera);
            mouseVectorRef.current.sub(camera.position).normalize();
            const distance = -camera.position.z / mouseVectorRef.current.z;
            mouseWorld = camera.position.clone().add(mouseVectorRef.current.multiplyScalar(distance));
        }

        // Particle Physics (Spring to Target + Mouse Repulsion)
        for(let i=0; i<PARTICLE_COUNT; i++) {
            const idx = i*3;
            
            const tx = target[idx];
            const ty = target[idx+1];
            const tz = target[idx+2];

            const px = positions[idx];
            const py = positions[idx+1];
            const pz = positions[idx+2];

            // 1. Spring force to shape
            const k = 0.02 + Math.random() * 0.01; 
            const ax = (tx - px) * k;
            const ay = (ty - py) * k;
            const az = (tz - pz) * k;

            // 2. Mouse Repulsion / Fluid Ripple
            // Calculate distance to mouse world position (ignoring heavy Z depth diff to simulate 2.5D interaction)
            const dx = px - mouseWorld.x;
            const dy = py - mouseWorld.y;
            const dz = pz - mouseWorld.z; // Include Z for true volumetric feel
            const distSq = dx*dx + dy*dy + dz*dz;
            
            let fx = 0, fy = 0, fz = 0;
            const interactRadius = 25000; // Squared radius (approx 150 units)

            if (distSq < interactRadius && distSq > 0.1) {
                const dist = Math.sqrt(distSq);
                const force = (1 - dist / Math.sqrt(interactRadius)) * 2.5; // Strong push
                fx = (dx / dist) * force;
                fy = (dy / dist) * force;
                fz = (dz / dist) * force;
            }

            // 3. Noise / Drift
            const noiseScale = 0.15;
            const nx = (Math.random() - 0.5) * noiseScale;
            const ny = (Math.random() - 0.5) * noiseScale;
            const nz = (Math.random() - 0.5) * noiseScale;

            vels[idx]   += ax + nx + fx;
            vels[idx+1] += ay + ny + fy;
            vels[idx+2] += az + nz + fz;

            // 4. Damping (Drag) - Simulates viscosity
            const friction = 0.92;
            vels[idx]   *= friction;
            vels[idx+1] *= friction;
            vels[idx+2] *= friction;

            // Update Position
            positions[idx]   += vels[idx];
            positions[idx+1] += vels[idx+1];
            positions[idx+2] += vels[idx+2];
        }
        
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [mode]);

  // --- 4. CHAT SIMULATION ---
  useEffect(() => {
    const names = ["PastaFan99", "GourmetHunter", "SchoolCanteen", "GioTeacher", "HungryStudent", "FoodCritic_X", "YummyYum"];
    const msgs = [
        "OMG IT EXPLODED!! 🤯",
        "Mathematical Beauty!",
        "Is that a heart? ❤️",
        "GIO GIO GIO",
        "It's like Interstellar...",
        "Chaotic but tasty",
        "Physics engine go brrr",
        "Mamma Mia! 🍝"
    ];
    const colors = ["#f87171", "#fbbf24", "#60a5fa", "#4ade80", "#c084fc"];
    const avatars = ["😲", "😋", "😱", "😂", "👨‍🍳", "🍝"];

    const interval = setInterval(() => {
        setComments(prev => {
            const newComment = {
                id: Date.now(),
                user: names[Math.floor(Math.random() * names.length)],
                text: msgs[Math.floor(Math.random() * msgs.length)],
                avatar: avatars[Math.floor(Math.random() * avatars.length)],
                color: colors[Math.floor(Math.random() * colors.length)]
            };
            return [newComment, ...prev].slice(0, 8);
        });
        setLikes(l => l + Math.floor(Math.random() * 50));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
      // Normalize to -1 to 1
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  const cycleMode = () => {
      const idx = MODES.indexOf(mode);
      const nextIdx = (idx + 1) % MODES.length;
      setMode(MODES[nextIdx]);
  };

  return (
    <div 
        ref={containerRef} 
        className="relative w-full h-full bg-black overflow-hidden"
        onMouseMove={handleMouseMove}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* --- UI OVERLAYS --- */}
      
      {/* 1. Live Stream UI (Top Left) */}
      <div className="absolute top-6 left-6 w-80 pointer-events-none z-10 flex flex-col gap-4">
         <div className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-red-900/40 p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-red-500 font-bold animate-pulse flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"/> LIVE
                </span>
                <span className="text-xs text-gray-400 font-mono">12,402 watching</span>
            </div>
            <div className="h-64 overflow-y-auto p-3 flex flex-col gap-2 mask-image-linear-to-b">
                {comments.map((c) => (
                    <div key={c.id} className="text-sm animate-[fadeIn_0.3s_ease-out]">
                        <span className="mr-2 opacity-80">{c.avatar}</span>
                        <span className="font-bold mr-2 text-shadow-sm" style={{color: c.color}}>{c.user}:</span>
                        <span className="text-white/80 font-light">{c.text}</span>
                    </div>
                ))}
            </div>
         </div>
         
         <div className="flex justify-start">
             <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-4 py-1 rounded-full font-bold shadow-lg text-sm flex items-center gap-2">
                 ❤️ {likes.toLocaleString()}
             </div>
         </div>
      </div>

      {/* 2. Shape Switcher (Bottom Center) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-4 z-20">
          <div className="text-white/30 font-mono text-xs tracking-[0.5em] uppercase mb-2">
              Current Mode: <span className="text-yellow-400 font-bold">{mode}</span>
          </div>
          
          <button 
            onClick={cycleMode}
            className="group relative px-8 py-3 bg-transparent overflow-hidden rounded-full border border-white/20 transition-all hover:border-yellow-400"
          >
              <div className="absolute inset-0 w-0 bg-yellow-400 transition-all duration-[250ms] ease-out group-hover:w-full opacity-10"></div>
              <span className="relative text-white font-bold tracking-widest group-hover:text-yellow-400 transition-colors">
                  SWITCH SHAPE ⟳
              </span>
          </button>
      </div>

      {/* 3. Restart (Bottom Right) */}
      <div className="absolute bottom-10 right-10 pointer-events-auto z-20">
          <button 
            onClick={onRestart}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg backdrop-blur border border-white/10 transition-all text-sm font-mono tracking-wide"
          >
              RESTART SYSTEM
          </button>
      </div>

    </div>
  );
};