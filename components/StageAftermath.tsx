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
    isGift?: boolean;
}

// --- CONSTANTS & TYPES ---
const MODES = ['CHAOS', 'FLOOR', 'CLUSTERS', 'HEART', 'GIO'] as const;
type VisualMode = typeof MODES[number];

const PARTICLE_COUNT = 2500; 
const INGREDIENT_DENSITY = 25; // Higher density of ingredients

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
  const eyeGroupRef = useRef<THREE.Group | null>(null);
  const nerveLineRef = useRef<THREE.Line | null>(null);
  
  // Physics Refs for Morphing
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const targetPositionsRef = useRef<Record<VisualMode, Float32Array> | null>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  
  // Eyeball Physics
  const eyePhysicsRef = useRef([
      { x: -100, y: 0, z: 0, vx: 0, vy: 0, vz: 0, anchorX: -150 },
      { x: 100, y: 0, z: 0, vx: 0, vy: 0, vz: 0, anchorX: 150 }
  ]);
  
  // Explosion Trigger
  const explosionForceRef = useRef(0);

  // Interaction Refs
  const mouseRef = useRef({ x: 0, y: 0 }); // Normalized -1 to 1
  const mouseVectorRef = useRef(new THREE.Vector3());
  
  const frameIdRef = useRef<number>(0);
  const timeRef = useRef(0);
  const dummyRef = useRef(new THREE.Object3D());

  // Texture Cache
  const ingredientTextures = useMemo(() => {
      const map = new Map<string, THREE.Texture>();
      // Use all collected ingredients or fallback if empty
      const list = ingredients.length > 0 ? ingredients : ['🍅', '🥬', '🦴', '👁️', '🥓', '🍄']; 
      
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

      // E. GIO (Refined)
      const txtCanvas = document.createElement('canvas');
      txtCanvas.width = 600; 
      txtCanvas.height = 300;
      const ctx = txtCanvas.getContext('2d');
      if (ctx) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0,0,600,300);
          ctx.fillStyle = '#fff';
          // Use bold sans-serif for uniform stroke width
          ctx.font = '900 200px Roboto, Arial, sans-serif'; 
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('GIO', 300, 150);
          
          const imgData = ctx.getImageData(0,0,600,300);
          const validPixels: number[] = [];
          
          // Denser sampling
          for(let y=0; y<300; y+=2) {
              for(let x=0; x<600; x+=2) {
                  const idx = (y*600 + x)*4;
                  if (imgData.data[idx] > 128) validPixels.push(idx/4); 
              }
          }

          for(let i=0; i<PARTICLE_COUNT; i++) {
              if (validPixels.length > 0) {
                  // Randomly pick a valid pixel to avoid striping patterns
                  const pxIndex = validPixels[Math.floor(Math.random() * validPixels.length)]; 
                  const pxX = pxIndex % 600;
                  const pxY = Math.floor(pxIndex / 600);
                  
                  targets.GIO[i*3] = (pxX - 300) * 1.5;
                  targets.GIO[i*3+1] = -(pxY - 150) * 1.5;
                  // Minimal Z variation for consistent flatness
                  targets.GIO[i*3+2] = (Math.random()-0.5) * 10; 
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);
    
    const headLight = new THREE.DirectionalLight(0xffffff, 0.8);
    headLight.position.set(0, 0, 1);
    camera.add(headLight);
    scene.add(camera);

    const rimLight = new THREE.PointLight(0xff0000, 0.5, 1000);
    rimLight.position.set(-200, 100, -200);
    scene.add(rimLight);

    // --- PARTICLE SYSTEM ---
    const targets = generateShapes(width, height);
    targetPositionsRef.current = targets;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const vels = new Float32Array(PARTICLE_COUNT * 3);

    // MATERIAL: Smaller, faceted chunks
    const geometry = new THREE.IcosahedronGeometry(0.7, 0); // Smaller base geometry
    const material = new THREE.MeshPhysicalMaterial({
        roughness: 0.4,
        metalness: 0.1,
        flatShading: true,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        color: 0xffffff
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
    let palette = mixedColors.length > 0 ? [...mixedColors] : ['#fbbf24', '#ef4444'];
    if (palette.length < 5) {
        const expanded: string[] = [];
        palette.forEach(hex => {
            const col = new THREE.Color(hex);
            expanded.push(hex);
            expanded.push('#' + col.clone().offsetHSL(0, 0, 0.1).getHexString());
            expanded.push('#' + col.clone().offsetHSL(0, 0, -0.1).getHexString());
        });
        palette = expanded;
    }

    const colorObj = new THREE.Color();
    const tempSprites: THREE.Sprite[] = [];

    for(let i=0; i<PARTICLE_COUNT; i++) {
        // Init Pos (Start exploded)
        positions[i*3] = targets.CHAOS[i*3];
        positions[i*3+1] = targets.CHAOS[i*3+1];
        positions[i*3+2] = targets.CHAOS[i*3+2];

        const isIngredient = (i % INGREDIENT_DENSITY === 0);

        if (isIngredient) {
            // Randomly pick from ALL collected ingredients
            const emoji = ingredientTextures.list[Math.floor(Math.random() * ingredientTextures.list.length)];
            const tex = ingredientTextures.map.get(emoji);
            const mat = new THREE.SpriteMaterial({ map: tex });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(45, 45, 1);
            spriteGroup.add(sprite);
            tempSprites.push(sprite);
            
            // Hide mesh instance
            dummyRef.current.position.set(0,0,0);
            dummyRef.current.scale.set(0,0,0);
            dummyRef.current.updateMatrix();
            mesh.setMatrixAt(i, dummyRef.current.matrix);
        } else {
            // Apply Colors
            const hex = palette[Math.floor(Math.random() * palette.length)]; // Randomly mix colors
            colorObj.set(hex);
            colorObj.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05); 
            mesh.setColorAt(i, colorObj);
            
            tempSprites.push(null as any); 
        }
    }
    
    (spriteGroup as any).userData.sprites = tempSprites;
    mesh.instanceColor!.needsUpdate = true;
    currentPositionsRef.current = positions;
    velocitiesRef.current = vels;

    // --- EYEBALLS & NERVES ---
    const eyeGroup = new THREE.Group();
    scene.add(eyeGroup);
    eyeGroupRef.current = eyeGroup;

    // Create Eyes
    const eyeGeo = new THREE.SphereGeometry(25, 32, 32);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(10, 32, 32);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    // Left Eye
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.z = 20;
    eyeL.add(pupilL);
    eyeGroup.add(eyeL);

    // Right Eye
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.z = 20;
    eyeR.add(pupilR);
    eyeGroup.add(eyeR);

    // Nerves (Lines)
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new Float32Array(2 * 2 * 3); // 2 lines, 2 points each, 3 coords
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const nerves = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(nerves);
    nerveLineRef.current = nerves;

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
        
        // --- EXPLOSION FORCE DECAY ---
        if (explosionForceRef.current > 0) {
            explosionForceRef.current *= 0.9; // Decay
        }

        const target = targetPositionsRef.current[mode];
        const positions = currentPositionsRef.current;
        const vels = velocitiesRef.current;
        const mesh = instancedMeshRef.current;
        const sprites = (spriteGroupRef.current as any).userData.sprites as (THREE.Sprite | null)[];
        const dummy = dummyRef.current;
        const camera = cameraRef.current;
        const eyeGroup = eyeGroupRef.current;
        const nerves = nerveLineRef.current;

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

        // --- EYEBALL PHYSICS ---
        if (eyeGroup && nerves && camera) {
            // Get screen top position in world space roughly
            // Just simulate an anchor point far above y=0
            const anchorY = 400;

            eyePhysicsRef.current.forEach((eye, i) => {
                const mesh = eyeGroup.children[i];
                
                // Spring to Anchor
                const dx = eye.anchorX - eye.x;
                const dy = anchorY - eye.y;
                const dz = 0 - eye.z;
                
                const springK = 0.01;
                eye.vx += dx * springK;
                eye.vy += dy * springK;
                eye.vz += dz * springK;

                // Gravity
                eye.vy -= 1.5;

                // Mouse Repulsion / Interaction
                const mdx = eye.x - mouseWorld.x;
                const mdy = eye.y - mouseWorld.y;
                const mdz = eye.z - mouseWorld.z;
                const mDist = Math.sqrt(mdx*mdx + mdy*mdy + mdz*mdz);
                if (mDist < 200) {
                    const f = (200 - mDist) * 0.1;
                    eye.vx += (mdx/mDist) * f;
                    eye.vy += (mdy/mDist) * f;
                    eye.vz += (mdz/mDist) * f;
                }

                // Explosion Force
                if (explosionForceRef.current > 0.1) {
                    const ex = eye.x; // Force from center (0,0,0)
                    const ey = eye.y;
                    const ez = eye.z;
                    const eDist = Math.sqrt(ex*ex + ey*ey + ez*ez) + 0.1;
                    const force = explosionForceRef.current * 2;
                    eye.vx += (ex/eDist) * force;
                    eye.vy += (ey/eDist) * force;
                    eye.vz += (ez/eDist) * force;
                }

                // Damping
                eye.vx *= 0.96;
                eye.vy *= 0.96;
                eye.vz *= 0.96;

                eye.x += eye.vx;
                eye.y += eye.vy;
                eye.z += eye.vz;

                // Floor bounce
                if (eye.y < -250) {
                    eye.y = -250;
                    eye.vy *= -0.8;
                }

                mesh.position.set(eye.x, eye.y, eye.z);
                mesh.lookAt(mouseWorld);
                
                // Update Line Geometry
                const positions = nerves.geometry.attributes.position.array as Float32Array;
                const idx = i * 6;
                // Anchor Point
                positions[idx] = eye.anchorX;
                positions[idx+1] = anchorY + 100; // Extend offscreen
                positions[idx+2] = 0;
                // Eye Point
                positions[idx+3] = eye.x;
                positions[idx+4] = eye.y;
                positions[idx+5] = eye.z;
            });
            nerves.geometry.attributes.position.needsUpdate = true;
        }

        // --- PARTICLE PHYSICS ---
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

            // Mouse Repulsion
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

            // Explosion Force
            if (explosionForceRef.current > 0.1) {
                 const ex = px;
                 const ey = py;
                 const ez = pz;
                 const eDist = Math.sqrt(ex*ex + ey*ey + ez*ez) + 0.1;
                 const force = explosionForceRef.current * (1.0 + Math.random());
                 fx += (ex/eDist) * force;
                 fy += (ey/eDist) * force;
                 fz += (ez/eDist) * force;
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
                // Smaller size logic: 5 base + sine wave
                const s = 6 + Math.sin(i + timeRef.current) * 3; 
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
    const names = ["PastaFan99", "GourmetHunter", "SchoolCanteen", "GioTeacher", "HungryStudent", "FoodCritic_X", "YummyYum", "SpaceChef"];
    const msgs = [
        "Physics = Broken 😂",
        "Look at those eyes lol",
        "Is this GIO or GOD?",
        "Beautiful chaos ❤️",
        "More sauce please!",
        "My GPU is screaming",
        "Wait, is that a mushroom?",
        "Mamma Mia! 🤌",
        "Entropy confirmed.",
        "Can I eat this?",
    ];
    const colors = ["#f87171", "#fbbf24", "#60a5fa", "#4ade80", "#c084fc", "#f472b6"];
    const avatars = ["😲", "😋", "😱", "😂", "👨‍🍳", "🍝", "👽", "🪐"];

    const interval = setInterval(() => {
        setComments(prev => {
            const newComment = {
                id: Date.now(),
                user: names[Math.floor(Math.random() * names.length)],
                text: msgs[Math.floor(Math.random() * msgs.length)],
                avatar: avatars[Math.floor(Math.random() * avatars.length)],
                color: colors[Math.floor(Math.random() * colors.length)]
            };
            // Keep fewer items for the floating effect
            return [...prev, newComment].slice(-8); 
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

  const sendGift = () => {
      // Trigger Explosion in Physics
      explosionForceRef.current = 50.0;
      setLikes(l => l + 500);
      setComments(prev => [
          ...prev,
          {
            id: Date.now(),
            user: "YOU",
            text: "EXPLOSION GIFT! 🎁💥",
            avatar: "🤠",
            color: "#fbbf24",
            isGift: true
          }
      ].slice(-8));
  };

  return (
    <div 
        ref={containerRef} 
        className="relative w-full h-full bg-black overflow-hidden"
        onMouseMove={handleMouseMove}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* --- UI: LEFT SIDE FLOATING CHAT --- */}
      <div className="absolute top-1/4 bottom-1/4 left-6 w-64 pointer-events-none z-10 flex flex-col justify-end gap-2 mask-image-linear-to-t">
            {comments.map((c) => (
                <div 
                    key={c.id} 
                    className={`
                        text-sm px-4 py-2 rounded-2xl backdrop-blur-md shadow-lg transform transition-all duration-500 animate-slide-up origin-left
                        ${c.isGift ? 'bg-gradient-to-r from-yellow-500/80 to-orange-500/80 border-2 border-white' : 'bg-black/40 border border-white/10'}
                    `}
                >
                    <div className="flex items-center gap-2">
                            <span className="text-lg">{c.avatar}</span>
                            <span className="font-bold text-shadow-sm truncate" style={{color: c.color}}>{c.user}</span>
                    </div>
                    <p className={`leading-snug mt-1 ${c.isGift ? 'text-white font-bold' : 'text-white/90'}`}>
                        {c.text}
                    </p>
                </div>
            ))}
      </div>
      
      {/* --- UI: TOP STATS --- */}
      <div className="absolute top-6 left-6 pointer-events-none z-10">
         <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2 shadow-lg">
             <span className="w-2 h-2 rounded-full bg-white"/> LIVE
             <span className="opacity-80 font-mono">15,892 VIEWERS</span>
         </div>
      </div>
         
      {/* --- UI: CONTROLS --- */}
      <div className="absolute bottom-10 left-10 pointer-events-auto flex items-center gap-4 z-20">
             <div className="bg-black/50 backdrop-blur text-white px-4 py-2 rounded-full font-bold shadow-lg text-sm border border-white/10">
                 ❤️ {likes.toLocaleString()}
             </div>
             
             <button 
                onClick={sendGift}
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-2 rounded-full font-bold shadow-lg text-sm hover:scale-105 active:scale-95 transition-transform border border-white/20 animate-pulse"
             >
                 🎁 Send Gift (BOOM!)
             </button>
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
      
      <style>{`
        @keyframes slide-up {
            0% { opacity: 0; transform: translateY(20px) scale(0.9); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-up {
            animation: slide-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .mask-image-linear-to-t {
             mask-image: linear-gradient(to top, black 80%, transparent 100%);
        }
      `}</style>
    </div>
  );
};