import React, { useEffect, useRef, useState, useMemo } from 'react';
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

const PARTICLE_COUNT = 2500; 
const INGREDIENT_DENSITY = 30; 

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
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const spriteGroupRef = useRef<THREE.Group | null>(null);
  
  // Physics Refs for Morphing
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const targetPositionsRef = useRef<Record<VisualMode, Float32Array> | null>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  
  // Interaction Refs
  const mouseRef = useRef({ x: 0, y: 0 }); // Normalized -1 to 1
  const mouseVectorRef = useRef(new THREE.Vector3());
  
  const frameIdRef = useRef<number>(0);
  const timeRef = useRef(0);
  const dummyRef = useRef(new THREE.Object3D());

  // Texture Cache
  const ingredientTextures = useMemo(() => {
      const map = new Map<string, THREE.Texture>();
      const list = ingredients.length > 0 ? ingredients : ['🍅', '🥬', '🦴', '👁️']; 
      
      list.forEach(emoji => {
          if (!map.has(emoji)) {
              const cvs = document.createElement('canvas');
              cvs.width = 128; cvs.height = 128;
              const ctx = cvs.getContext('2d');
              if (ctx) {
                  ctx.clearRect(0, 0, 128, 128);
                  ctx.font = '90px serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(emoji, 64, 70);
              }
              const tex = new THREE.CanvasTexture(cvs);
              tex.colorSpace = THREE.SRGBColorSpace;
              map.set(emoji, tex);
          }
      });
      return { map, list };
  }, [ingredients]);

  // --- 1. SHAPE GENERATORS ---
  const generateShapes = (width: number, height: number) => {
      const targets: Record<VisualMode, Float32Array> = {
          CHAOS: new Float32Array(PARTICLE_COUNT * 3),
          FLOOR: new Float32Array(PARTICLE_COUNT * 3),
          CLUSTERS: new Float32Array(PARTICLE_COUNT * 3),
          HEART: new Float32Array(PARTICLE_COUNT * 3),
          GIO: new Float32Array(PARTICLE_COUNT * 3),
      };

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

      // A. CHAOS
      for(let i=0; i<PARTICLE_COUNT; i++) {
          const p = randomSphere(600);
          targets.CHAOS[i*3] = p.x;
          targets.CHAOS[i*3+1] = p.y;
          targets.CHAOS[i*3+2] = p.z;
      }

      // B. FLOOR
      for(let i=0; i<PARTICLE_COUNT; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 500;
          targets.FLOOR[i*3] = Math.cos(angle) * r;
          targets.FLOOR[i*3+1] = -250 + (Math.random() * 40); 
          targets.FLOOR[i*3+2] = Math.sin(angle) * r;
      }

      // C. CLUSTERS
      const centers: {x:number, y:number, z:number}[] = [];
      for(let c=0; c<30; c++) {
          centers.push(randomSphere(300));
      }
      for(let i=0; i<PARTICLE_COUNT; i++) {
          const center = centers[i % 30];
          const puff = randomSphere(40);
          targets.CLUSTERS[i*3] = center.x + puff.x;
          targets.CLUSTERS[i*3+1] = center.y + puff.y;
          targets.CLUSTERS[i*3+2] = center.z + puff.z;
      }

      // D. HEART
      for(let i=0; i<PARTICLE_COUNT; i++) {
          const t = Math.random() * Math.PI * 2;
          const scale = 15;
          const x = 16 * Math.pow(Math.sin(t), 3);
          const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
          
          const thickness = 10 + Math.random() * 10;
          
          targets.HEART[i*3] = x * scale + (Math.random()-0.5)*thickness;
          targets.HEART[i*3+1] = y * scale + (Math.random()-0.5)*thickness + 50; 
          targets.HEART[i*3+2] = (Math.random()-0.5) * 60; 
      }

      // E. GIO
      const txtCanvas = document.createElement('canvas');
      txtCanvas.width = 500; 
      txtCanvas.height = 250;
      const ctx = txtCanvas.getContext('2d');
      if (ctx) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0,0,500,250);
          ctx.fillStyle = '#fff';
          ctx.font = '900 180px Arial'; 
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('GIO', 250, 125);
          
          const imgData = ctx.getImageData(0,0,500,250);
          const validPixels: number[] = [];
          
          for(let y=0; y<250; y+=3) {
              for(let x=0; x<500; x+=3) {
                  const idx = (y*500 + x)*4;
                  if (imgData.data[idx] > 100) validPixels.push(idx/4); 
              }
          }

          for(let i=0; i<PARTICLE_COUNT; i++) {
              if (validPixels.length > 0) {
                  const pxIndex = validPixels[i % validPixels.length]; 
                  const pxX = pxIndex % 500;
                  const pxY = Math.floor(pxIndex / 500);
                  
                  targets.GIO[i*3] = (pxX - 250) * 1.8 + (Math.random()-0.5)*5;
                  targets.GIO[i*3+1] = -(pxY - 125) * 1.8 + (Math.random()-0.5)*5;
                  targets.GIO[i*3+2] = (Math.random()-0.5) * 20;
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

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a); 

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    camera.position.z = 600;
    camera.position.y = 50;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current, 
        antialias: true,
        alpha: false 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // CRITICAL: Ensure colors are rendered in sRGB so they look correct (not too dark/muddy)
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Increased ambient
    scene.add(ambientLight);
    
    // Headlight attached to camera (always illuminates what we look at)
    const headLight = new THREE.DirectionalLight(0xffffff, 0.8);
    headLight.position.set(0, 0, 1);
    camera.add(headLight);
    scene.add(camera);

    const rimLight = new THREE.PointLight(0xff0000, 0.5, 1000);
    rimLight.position.set(-200, 100, -200);
    scene.add(rimLight);

    // Buffers
    const targets = generateShapes(width, height);
    targetPositionsRef.current = targets;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const vels = new Float32Array(PARTICLE_COUNT * 3);

    // MATERIAL: Wet, Chunky Food Look
    const geometry = new THREE.IcosahedronGeometry(1, 0); 
    const material = new THREE.MeshPhysicalMaterial({
        roughness: 0.5,
        metalness: 0.1,
        flatShading: true,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        color: 0xffffff // Base color must be white for instance colors to show correctly
    });
    
    const mesh = new THREE.InstancedMesh(geometry, material, PARTICLE_COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    instancedMeshRef.current = mesh;

    // Sprites (Ingredients)
    const spriteGroup = new THREE.Group();
    scene.add(spriteGroup);
    spriteGroupRef.current = spriteGroup;
    
    // COLOR PALETTE LOGIC
    // Ensure we have a rich palette even if only 1 color was passed
    let palette = mixedColors.length > 0 ? [...mixedColors] : ['#fbbf24', '#ef4444'];
    
    // If palette is small, generate variations to avoid monotone look
    if (palette.length < 5) {
        const expanded: string[] = [];
        palette.forEach(hex => {
            const col = new THREE.Color(hex);
            expanded.push(hex);
            expanded.push('#' + col.clone().offsetHSL(0, 0, 0.1).getHexString()); // Lighter
            expanded.push('#' + col.clone().offsetHSL(0, 0, -0.1).getHexString()); // Darker
        });
        palette = expanded;
    }

    const colorObj = new THREE.Color();
    const tempSprites: THREE.Sprite[] = [];

    for(let i=0; i<PARTICLE_COUNT; i++) {
        // Init Pos
        positions[i*3] = targets.CHAOS[i*3];
        positions[i*3+1] = targets.CHAOS[i*3+1];
        positions[i*3+2] = targets.CHAOS[i*3+2];

        const isIngredient = (i % INGREDIENT_DENSITY === 0);

        if (isIngredient) {
            const emoji = ingredientTextures.list[i % ingredientTextures.list.length];
            const tex = ingredientTextures.map.get(emoji);
            const mat = new THREE.SpriteMaterial({ map: tex });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(45, 45, 1);
            spriteGroup.add(sprite);
            tempSprites.push(sprite);
            
            // Hide mesh
            dummyRef.current.position.set(0,0,0);
            dummyRef.current.scale.set(0,0,0);
            dummyRef.current.updateMatrix();
            mesh.setMatrixAt(i, dummyRef.current.matrix);
        } else {
            // Apply Colors from Palette
            const hex = palette[i % palette.length];
            colorObj.set(hex);
            // Slight noise per particle for realism
            colorObj.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05); 
            mesh.setColorAt(i, colorObj);
            
            tempSprites.push(null as any); 
        }
    }
    
    (spriteGroup as any).userData.sprites = tempSprites;

    mesh.instanceColor!.needsUpdate = true;
    currentPositionsRef.current = positions;
    velocitiesRef.current = vels;

    // Refs
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
  }, [mixedColors, ingredientTextures]);

  // --- 3. ANIMATION LOOP ---
  useEffect(() => {
    const loop = () => {
        if (!instancedMeshRef.current || 
            !targetPositionsRef.current || 
            !currentPositionsRef.current || 
            !velocitiesRef.current) return;

        timeRef.current += 0.01;
        const target = targetPositionsRef.current[mode];
        const positions = currentPositionsRef.current;
        const vels = velocitiesRef.current;
        const mesh = instancedMeshRef.current;
        const sprites = (spriteGroupRef.current as any).userData.sprites as (THREE.Sprite | null)[];
        const dummy = dummyRef.current;
        const camera = cameraRef.current;

        // Camera Orbit
        if (camera) {
            const r = 550 + Math.sin(timeRef.current * 0.5) * 50;
            const speed = 0.2;
            const targetX = r * Math.cos(timeRef.current * speed + mouseRef.current.x * 0.5);
            const targetZ = r * Math.sin(timeRef.current * speed + mouseRef.current.x * 0.5);
            const targetY = 50 + mouseRef.current.y * 100;

            camera.position.x += (targetX - camera.position.x) * 0.05;
            camera.position.z += (targetZ - camera.position.z) * 0.05;
            camera.position.y += (targetY - camera.position.y) * 0.05;
            camera.lookAt(0, 0, 0);
        }

        // Mouse Projection
        let mouseWorld = new THREE.Vector3(0,0,0);
        if (camera) {
            mouseVectorRef.current.set(mouseRef.current.x, mouseRef.current.y, 0.5);
            mouseVectorRef.current.unproject(camera);
            mouseVectorRef.current.sub(camera.position).normalize();
            const distance = -camera.position.z / mouseVectorRef.current.z;
            mouseWorld = camera.position.clone().add(mouseVectorRef.current.multiplyScalar(distance));
        }

        // Physics
        for(let i=0; i<PARTICLE_COUNT; i++) {
            const idx = i*3;
            
            const tx = target[idx];
            const ty = target[idx+1];
            const tz = target[idx+2];

            const px = positions[idx];
            const py = positions[idx+1];
            const pz = positions[idx+2];

            // Spring
            const k = 0.02 + Math.random() * 0.01; 
            const ax = (tx - px) * k;
            const ay = (ty - py) * k;
            const az = (tz - pz) * k;

            // Repulsion
            const dx = px - mouseWorld.x;
            const dy = py - mouseWorld.y;
            const dz = pz - mouseWorld.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            
            let fx = 0, fy = 0, fz = 0;
            const interactRadius = 25000; 

            if (distSq < interactRadius && distSq > 0.1) {
                const dist = Math.sqrt(distSq);
                const force = (1 - dist / Math.sqrt(interactRadius)) * 3.0;
                fx = (dx / dist) * force;
                fy = (dy / dist) * force;
                fz = (dz / dist) * force;
            }

            // Noise
            const noiseScale = 0.2;
            const nx = (Math.random() - 0.5) * noiseScale;
            const ny = (Math.random() - 0.5) * noiseScale;
            const nz = (Math.random() - 0.5) * noiseScale;

            vels[idx]   += ax + nx + fx;
            vels[idx+1] += ay + ny + fy;
            vels[idx+2] += az + nz + fz;

            // Drag
            const friction = 0.93;
            vels[idx]   *= friction;
            vels[idx+1] *= friction;
            vels[idx+2] *= friction;

            positions[idx]   += vels[idx];
            positions[idx+1] += vels[idx+1];
            positions[idx+2] += vels[idx+2];

            // Update Transforms
            const isIngredient = (i % INGREDIENT_DENSITY === 0);
            if (isIngredient) {
                const sprite = sprites[i];
                if (sprite) {
                    sprite.position.set(positions[idx], positions[idx+1], positions[idx+2]);
                }
            } else {
                dummy.position.set(positions[idx], positions[idx+1], positions[idx+2]);
                const rotSpeed = 0.05 + i * 0.0001;
                dummy.rotation.set(timeRef.current + rotSpeed, timeRef.current * 0.5 + i, i);
                const s = 10 + Math.sin(i + timeRef.current) * 4; 
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
        }
        
        mesh.instanceMatrix.needsUpdate = true;
        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [mode]);

  // --- 4. CHAT ---
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