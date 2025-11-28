import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface StageAftermathProps {
    onRestart: () => void;
    mixedColors: string[];
    ingredients: string[];
    videoStream: MediaStream | null;
}

interface BubbleComment {
    id: number;
    user: string;
    text: string;
    avatar: string;
    left: number; // 0-100%
    sizeScale: number;
    speed: number;
}

enum ParticleMode {
    CHAOS = 'CHAOS',
    BOWLS = 'BOWLS',
    HEART = 'HEART',
    GIO = 'GIO',
    SHATTER = 'SHATTER'
}

// Helper: Emoji Texture for Ingredients
const createEmojiTexture = (emoji: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.font = 'bold 90px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(emoji, 64, 70);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

// Helper: Solid Circle for Chunks
const createSolidCircleTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; 
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
};

// Helper: Eyeball Texture
const createEyeballTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Sclera
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fillStyle = '#f3f4f6';
        ctx.fill();
        
        // Veins
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)'; // Red veins
        ctx.lineWidth = 2;
        for(let i=0; i<6; i++) {
            const angle = (Math.PI * 2 / 6) * i + Math.random() * 0.5;
            ctx.beginPath();
            ctx.moveTo(64 + Math.cos(angle)*30, 64 + Math.sin(angle)*30);
            ctx.quadraticCurveTo(
                64 + Math.cos(angle)*50, 
                64 + Math.sin(angle)*50,
                64 + Math.cos(angle)*60, 
                64 + Math.sin(angle)*60
            );
            ctx.stroke();
        }

        // Iris
        ctx.beginPath();
        ctx.arc(64, 64, 32, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626'; // Monster Red
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#7f1d1d';
        ctx.stroke();

        // Pupil
        ctx.beginPath();
        ctx.arc(64, 64, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        
        // Shine
        ctx.beginPath();
        ctx.arc(80, 48, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
};

export const StageAftermath: React.FC<StageAftermathProps> = ({ onRestart, mixedColors, ingredients, videoStream }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modeRef = useRef<ParticleMode>(ParticleMode.CHAOS); // Default to Chaos (Explosion)
  const particleTargetsRef = useRef<Float32Array | null>(null);
  const timeRef = useRef(0);
  const mousePosRef = useRef(new THREE.Vector3(0,0,0));
  
  const particlesRef = useRef<THREE.Points | null>(null);
  const ingredientSpritesRef = useRef<THREE.Sprite[]>([]);
  const eyeballsRef = useRef<THREE.Sprite[]>([]);
  const bowlCentersRef = useRef<THREE.Vector3[]>([]);    

  const isHandActiveRef = useRef(false);
  
  const [comments, setComments] = useState<BubbleComment[]>([]);
  const [likes, setLikes] = useState(2500);
  const [activeMode, setActiveMode] = useState<ParticleMode>(ParticleMode.CHAOS);
  const [flashOpacity, setFlashOpacity] = useState(1);
  const [showBowlText, setShowBowlText] = useState(false); 
  const [giftEffect, setGiftEffect] = useState<{id:number, x:number, emoji:string}[]>([]);

  // Vision Refs
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);

  // --- Vision Setup ---
  useEffect(() => {
    const setupVision = async () => {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
        } catch (e) {
            console.error("Failed to load MediaPipe Hands", e);
        }
    };
    setupVision();
  }, []);

  // Sync Video
  useEffect(() => {
    if (videoRef.current && videoStream) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.log("Video play error", e));
        };
    }
  }, [videoStream]);

  // --- Chat Bubble Generator ---
  useEffect(() => {
      const users = ["Foodie_HK", "Campus_Cat", "Prof_Gio", "SpaghettiLover", "PolyU_Student", "Canteen_Critic", "YummyYum"];
      const messages = [
          "Looks delicious! 🤤", "So satisfying to watch!", "Is that edible? 😂", 
          "Chef is cooking!! 👨‍🍳", "I want some!", "Wait, what did you put in there?", 
          "More cheese please!", "5 Stars! ⭐⭐⭐⭐⭐", "Epic meal time", "Can I have the recipe?"
      ];
      const avatars = ["🍔", "🐱", "👨‍🏫", "🍝", "🎓", "🧐", "😋"];

      const interval = setInterval(() => {
          const id = Date.now();
          const newComment: BubbleComment = {
              id,
              user: users[Math.floor(Math.random() * users.length)],
              text: messages[Math.floor(Math.random() * messages.length)],
              avatar: avatars[Math.floor(Math.random() * avatars.length)],
              left: Math.random() * 80 + 5,
              sizeScale: 0.8 + Math.random() * 0.4,
              speed: 2 + Math.random() * 2 
          };
          
          setComments(prev => {
              const keep = prev.filter(c => (Date.now() - c.id) < 6000); 
              return [...keep, newComment];
          });
      }, 1200);

      return () => clearInterval(interval);
  }, []);


  // --- Target Generators ---
  const PARTICLE_COUNT = 1200; // Increased for "Exploded" feel
  const EYEBALL_COUNT = 8;
  // Total objects to manage targets for
  const TOTAL_OBJECTS = PARTICLE_COUNT + ingredients.length + EYEBALL_COUNT;

  const generateTargets = (mode: ParticleMode) => {
      const targets = new Float32Array(TOTAL_OBJECTS * 3);
      
      if (mode === ParticleMode.BOWLS) {
        const bowlCount = 30;
        if (bowlCentersRef.current.length !== bowlCount) {
            bowlCentersRef.current = [];
            for(let i=0; i<bowlCount; i++) {
                bowlCentersRef.current.push(new THREE.Vector3(
                    (Math.random()-0.5)*700, 
                    (Math.random()-0.5)*400, 
                    (Math.random()-0.5)*100
                ));
            }
        }
        for(let i=0; i<TOTAL_OBJECTS; i++) {
            const c = bowlCentersRef.current[i % bowlCount];
            const theta = Math.random() * Math.PI * 2;
            const r = Math.random() * 30;
            targets[i*3] = c.x + Math.cos(theta)*r;
            targets[i*3+1] = c.y + (Math.random())*25 - 5; 
            targets[i*3+2] = c.z + Math.sin(theta)*r;
        }

      } else if (mode === ParticleMode.HEART) {
        for(let i=0; i<TOTAL_OBJECTS; i++) {
            const t = Math.random() * Math.PI * 2;
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            const scale = 14;
            targets[i*3] = x * scale + (Math.random()-0.5)*20;
            targets[i*3+1] = y * scale + 50 + (Math.random()-0.5)*20;
            targets[i*3+2] = (Math.random()-0.5) * 60;
        }

      } else if (mode === ParticleMode.GIO) {
          const setP = (i: number, x: number, y: number) => {
            targets[i*3] = x + (Math.random()-0.5)*30; 
            targets[i*3+1] = y + (Math.random()-0.5)*30;
            targets[i*3+2] = (Math.random()-0.5)*50;
          };
          const part1 = Math.floor(TOTAL_OBJECTS * 0.4);
          const part2 = Math.floor(TOTAL_OBJECTS * 0.6);
          
          const gCenterX = -250; const gRadius = 110;
          for (let i = 0; i < part1; i++) {
              const ratio = i / part1;
              if (ratio < 0.75) {
                  const angle = (Math.PI/4) + (ratio/0.75) * (1.5 * Math.PI);
                  setP(i, gCenterX + Math.cos(angle)*gRadius, Math.sin(angle)*gRadius);
              } else {
                  const lineRatio = (ratio - 0.75) / 0.25;
                  setP(i, (gCenterX + gRadius) - lineRatio * (gRadius * 0.6), -gRadius * 0.1);
              }
          }
          for (let i = part1; i < part2; i++) {
              const ratio = (i - part1) / (part2 - part1);
              const y = (ratio - 0.5) * 260;
              setP(i, 0, y);
          }
          const oCenterX = 250;
          for (let i = part2; i < TOTAL_OBJECTS; i++) {
              const ratio = (i - part2) / (TOTAL_OBJECTS - part2);
              const angle = ratio * Math.PI * 2;
              setP(i, oCenterX + Math.cos(angle)*110, Math.sin(angle)*110);
          }

      } else if (mode === ParticleMode.SHATTER) {
        for(let i=0; i<TOTAL_OBJECTS; i++) {
            targets[i*3] = (Math.random()-0.5) * 900;
            targets[i*3+1] = -300 + Math.random() * 40; 
            targets[i*3+2] = (Math.random()-0.5) * 500;
        }
      }

      return targets;
  };

  const handleSendGift = () => {
      const id = Date.now();
      const emojis = ['🎁', '💎', '🚀', '🍝', '👑', '🏰'];
      const chosenEmoji = emojis[Math.floor(Math.random()*emojis.length)];

      setGiftEffect(prev => [...prev, { id, x: Math.random() * 100, emoji: chosenEmoji }]);
      setLikes(l => l + 500);
      
      const newComment: BubbleComment = {
          id: id + 1,
          user: "YOU",
          text: `sent ${chosenEmoji} Super Gift!`,
          avatar: "😎",
          left: 50,
          sizeScale: 1.2,
          speed: 3
      };
      setComments(prev => [...prev, newComment]);

      setTimeout(() => {
          setGiftEffect(prev => prev.filter(e => e.id !== id));
      }, 2000);
  };

  const switchMode = (newMode: ParticleMode) => {
      modeRef.current = newMode;
      setActiveMode(newMode);
      setShowBowlText(newMode === ParticleMode.BOWLS);

      if (newMode !== ParticleMode.CHAOS) {
          particleTargetsRef.current = generateTargets(newMode);
      } else {
          particleTargetsRef.current = null;
      }
  };

  useEffect(() => {
    const timer = setTimeout(() => setFlashOpacity(0), 100);
    return () => clearTimeout(timer);
  }, []);

  // --- Three.js Initialization ---
  useEffect(() => {
    if (!containerRef.current) return;
    
    if (rendererRef.current && rendererRef.current.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    // Dark Reddish Black background for Aftermath vibe
    scene.background = new THREE.Color(0x1a0505); 
    scene.fog = new THREE.FogExp2(0x1a0505, 0.0008);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 3000);
    camera.position.z = 800;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- 1. Sauce Chunks (Particles) ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    const palette = mixedColors.length > 0 ? mixedColors : ['#fbbf24', '#f59e0b', '#b45309', '#78350f'];

    for(let i=0; i<PARTICLE_COUNT; i++) {
        // Broad initial explosion distribution
        positions[i*3] = (Math.random()-0.5) * 600;
        positions[i*3+1] = (Math.random()-0.5) * 600;
        positions[i*3+2] = (Math.random()-0.5) * 400;

        const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
        c.offsetHSL(0, 0, (Math.random()-0.5)*0.1);
        
        colors[i*3] = c.r;
        colors[i*3+1] = c.g;
        colors[i*3+2] = c.b;

        // Varied chunk sizes
        sizes[i] = Math.random() > 0.8 ? 25 + Math.random()*25 : 8 + Math.random()*8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({ 
        size: 1, 
        vertexColors: true, 
        map: createSolidCircleTexture(), 
        blending: THREE.NormalBlending, 
        depthTest: true, 
        transparent: true,
        opacity: 0.95 
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // --- 2. Ingredient Sprites ---
    const ingredientSprites: THREE.Sprite[] = [];
    const usedIngredients = ingredients.length > 0 ? ingredients : ['🍅', '🍄', '🥩'];
    
    usedIngredients.forEach((emoji) => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: createEmojiTexture(emoji),
            transparent: true,
            opacity: 1.0
        }));
        const scale = 50 + Math.random() * 30;
        sprite.scale.set(scale, scale, 1);
        sprite.position.set((Math.random()-0.5)*500, (Math.random()-0.5)*500, (Math.random()-0.5)*500);
        scene.add(sprite);
        ingredientSprites.push(sprite);
    });
    ingredientSpritesRef.current = ingredientSprites;

    // --- 3. Eyeball Sprites (Restored!) ---
    const eyeballs: THREE.Sprite[] = [];
    for(let i=0; i<EYEBALL_COUNT; i++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: createEyeballTexture(),
            transparent: true,
            opacity: 1.0
        }));
        // 2 Big Monster Eyes, rest smaller debris
        const size = i < 2 ? 140 : 40 + Math.random() * 30;
        sprite.scale.set(size, size, 1);
        sprite.position.set(
            (Math.random()-0.5)*600, 
            (Math.random()-0.5)*600, 
            (Math.random()-0.5)*600
        );
        scene.add(sprite);
        eyeballs.push(sprite);
    }
    eyeballsRef.current = eyeballs;

    // Set Default Mode to CHAOS for explosion feel
    switchMode(ParticleMode.CHAOS);

    // --- Animation Loop ---
    const animate = () => {
        const now = performance.now();
        timeRef.current += 0.004;

        // Vision Hand Track
        if (videoRef.current && handLandmarkerRef.current && now - lastVideoTimeRef.current > 50) {
             lastVideoTimeRef.current = now;
             const res = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
             
             if (res.landmarks && res.landmarks.length > 0) {
                 isHandActiveRef.current = true;
                 const hand = res.landmarks[0];
                 const palm = hand[9]; 
                 const vH = 2 * 800 * Math.tan(THREE.MathUtils.degToRad(30));
                 const vW = vH * (width / height);
                 mousePosRef.current.set(
                     (1 - palm.x - 0.5) * vW,
                     -(palm.y - 0.5) * vH,
                     0
                 );
             } else {
                 isHandActiveRef.current = false;
             }
        }

        const posAttr = particles.geometry.attributes.position;
        const posArr = posAttr.array as Float32Array;
        const targets = particleTargetsRef.current;
        const mousePos = mousePosRef.current;
        const isInteracting = isHandActiveRef.current;

        // 1. Update Particles
        for(let i=0; i<PARTICLE_COUNT; i++) {
            const idx = i*3;
            let px = posArr[idx];
            let py = posArr[idx+1];
            let pz = posArr[idx+2];

            if (targets && modeRef.current !== ParticleMode.CHAOS) {
                const tx = targets[idx];
                const ty = targets[idx+1];
                const tz = targets[idx+2];
                const lerpFactor = 0.03 + Math.random() * 0.02; 
                px += (tx - px) * lerpFactor;
                py += (ty - py) * lerpFactor;
                pz += (tz - pz) * lerpFactor;
            } 
            
            // Floating Drift
            const drift = 0.6;
            px += Math.sin(timeRef.current + py * 0.005) * drift;
            py += Math.cos(timeRef.current + px * 0.005) * drift;

            // Hand Repulsion
            if (isInteracting) {
                const dx = px - mousePos.x;
                const dy = py - mousePos.y;
                const dz = pz - mousePos.z;
                const distSq = dx*dx + dy*dy + dz*dz;
                if (distSq < 300*300) {
                    const dist = Math.sqrt(distSq);
                    const force = (300 - dist) / 300;
                    const repulsion = force * 15;
                    px += (dx/dist) * repulsion;
                    py += (dy/dist) * repulsion;
                    pz += (dz/dist) * repulsion;
                }
            }
            
            // Gravity only in SHATTER mode
            if (modeRef.current === ParticleMode.SHATTER) {
                if (py > -350) py -= 1; 
            }

            posArr[idx] = px;
            posArr[idx+1] = py;
            posArr[idx+2] = pz;
        }
        posAttr.needsUpdate = true;

        // Helper for Sprite Updates
        const updateSprite = (sprite: THREE.Sprite, indexOffset: number) => {
            const targetIndex = indexOffset * 3;
            let tx = sprite.position.x; 
            let ty = sprite.position.y; 
            let tz = sprite.position.z;

            if (targets && modeRef.current !== ParticleMode.CHAOS) {
                tx = targets[targetIndex];
                ty = targets[targetIndex+1];
                tz = targets[targetIndex+2];
                sprite.position.lerp(new THREE.Vector3(tx, ty, tz), 0.02);
            } else {
                 // Chaos Float
                 sprite.position.y += Math.sin(timeRef.current + indexOffset) * 0.5;
            }

            // Repulsion
            if (isInteracting) {
                const dist = sprite.position.distanceTo(mousePos);
                if (dist < 300) {
                     const dir = sprite.position.clone().sub(mousePos).normalize().multiplyScalar(5);
                     sprite.position.add(dir);
                }
            }
            sprite.material.rotation = Math.sin(timeRef.current * 0.5 + indexOffset) * 0.15;
        };

        // 2. Update Ingredients
        ingredientSprites.forEach((sprite, i) => updateSprite(sprite, PARTICLE_COUNT + i));

        // 3. Update Eyeballs
        eyeballs.forEach((sprite, i) => updateSprite(sprite, PARTICLE_COUNT + ingredientSprites.length + i));

        // Camera Spin
        scene.rotation.y = Math.sin(timeRef.current * 0.15) * 0.08;

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
        if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        cameraRef.current.aspect = w/h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        if (rendererRef.current && containerRef.current) {
             containerRef.current.removeChild(rendererRef.current.domElement);
             rendererRef.current.dispose();
        }
        geometry.dispose();
    };
  }, [mixedColors, ingredients]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-sans">
        <style>{`
            @keyframes floatBubble {
                0% { transform: translateY(100px) scale(0.8); opacity: 0; }
                10% { transform: translateY(0) scale(1); opacity: 1; }
                80% { opacity: 1; }
                100% { transform: translateY(-600px) scale(1.1); opacity: 0; }
            }
            .animate-float {
                animation-name: floatBubble;
                animation-timing-function: linear;
                animation-fill-mode: forwards;
            }
        `}</style>
        
        <div ref={containerRef} className="absolute inset-0 z-0" />
        <video ref={videoRef} className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" muted playsInline />

        <div 
            className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-1000 z-50" 
            style={{ opacity: flashOpacity }}
        />

        {/* Floating Chat */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {comments.map((c) => (
                <div 
                    key={c.id} 
                    className="absolute flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/20 shadow-xl animate-float"
                    style={{
                        left: `${c.left}%`,
                        bottom: '0px',
                        animationDuration: `${c.speed}s`,
                        transformOrigin: 'center bottom',
                        scale: c.sizeScale
                    }}
                >
                    <div className="text-xl filter drop-shadow-md">{c.avatar}</div>
                    <div className="flex flex-col leading-tight">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.user}</span>
                         <span className="text-sm font-bold text-white drop-shadow-sm whitespace-nowrap">{c.text}</span>
                    </div>
                </div>
            ))}
        </div>

        {/* UI Controls */}
        <div className="absolute bottom-10 left-0 w-full flex flex-col items-center gap-8 z-30 pointer-events-none">
            
            <div className="flex gap-3 p-2 bg-neutral-900/80 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl pointer-events-auto">
                {[
                    { id: ParticleMode.CHAOS, icon: '💥', label: 'Exploded' },
                    { id: ParticleMode.BOWLS, icon: '🍜', label: 'Serve' },
                    { id: ParticleMode.HEART, icon: '❤️', label: 'Love' },
                    { id: ParticleMode.GIO, icon: '👨‍🏫', label: 'Gio' },
                    { id: ParticleMode.SHATTER, icon: '⬇️', label: 'Drop' },
                ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => switchMode(m.id as ParticleMode)}
                        className={`
                            px-4 py-3 rounded-full flex items-center gap-2 transition-all duration-300
                            ${activeMode === m.id 
                                ? 'bg-white text-black font-bold scale-110 shadow-[0_0_20px_rgba(255,255,255,0.4)]' 
                                : 'text-gray-400 hover:bg-white/10 hover:text-white'}
                        `}
                    >
                        <span className="text-xl">{m.icon}</span>
                        <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">{m.label}</span>
                    </button>
                ))}
            </div>

            <div className="flex gap-6 items-center pointer-events-auto">
                 <button 
                    onClick={handleSendGift}
                    className="group relative bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white px-8 py-3 rounded-2xl font-bold text-lg shadow-[0_0_30px_rgba(236,72,153,0.4)] border border-white/20 transition-all active:scale-95 flex items-center gap-3 overflow-hidden"
                 >
                    <span className="text-2xl animate-bounce">🎁</span>
                    <span className="relative z-10">Send Gift</span>
                 </button>

                 <button 
                    onClick={onRestart}
                    className="bg-white/5 hover:bg-white/15 text-white px-8 py-3 rounded-2xl font-bold text-lg border border-white/10 backdrop-blur transition-all active:scale-95 flex items-center gap-2"
                 >
                    <span>🔄</span> Play Again
                 </button>
            </div>
        </div>

        <div className="absolute top-8 right-8 bg-black/40 backdrop-blur-md px-5 py-2 rounded-full border border-pink-500/30 text-pink-500 font-bold text-xl flex items-center gap-2 z-30 shadow-lg pointer-events-none">
            <span className="animate-pulse">❤️</span> {likes.toLocaleString()}
        </div>

        {giftEffect.map(g => (
            <div 
                key={g.id}
                className="absolute top-1/2 left-0 text-8xl animate-bounce pointer-events-none z-50 filter drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]"
                style={{ 
                    left: `${g.x}%`, 
                    marginTop: '-150px',
                    transform: `rotate(${(Math.random()-0.5)*30}deg)`
                }}
            >
                {g.emoji}
            </div>
        ))}
        
        {showBowlText && (
            <div className="absolute top-1/4 w-full text-center pointer-events-none z-20">
                <h2 className="text-7xl md:text-9xl font-bold text-yellow-400 handwritten drop-shadow-[0_4px_4px_rgba(0,0,0,1)] animate-pulse">
                    Order Up!
                </h2>
                <div className="flex justify-center mt-4">
                     <span className="bg-red-600 text-white px-4 py-1 rounded text-xl font-bold rotate-[-2deg] shadow-lg">SOLD OUT</span>
                </div>
            </div>
        )}

        {isHandActiveRef.current && (
             <div 
                className="absolute w-20 h-20 border-4 border-white/30 rounded-full pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                style={{ 
                    left: '50%', 
                    top: '50%',
                    transform: `translate(${mousePosRef.current.x + containerRef.current!.clientWidth/2}px, ${-mousePosRef.current.y + containerRef.current!.clientHeight/2}px)`
                }}
             />
        )}
    </div>
   );
};