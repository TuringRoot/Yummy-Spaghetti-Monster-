
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import { audio } from '../utils/audio';

interface StageFeedingProps {
  collectedIngredients: string[];
  onComplete: (finalColors: string[]) => void;
  videoStream: MediaStream | null;
}

const SAUCES = [
  { id: 'ketchup', color: '#ef4444', label: 'Tomato', lightColor: '#fecaca', darkColor: '#991b1b' },
  { id: 'cream', color: '#f3f4f6', label: 'Cream', lightColor: '#ffffff', darkColor: '#d1d5db' },
  { id: 'pesto', color: '#22c55e', label: 'Pesto', lightColor: '#86efac', darkColor: '#15803d' },
  { id: 'mystery', color: '#a855f7', label: 'Mystery', lightColor: '#e9d5ff', darkColor: '#6b21a8' },
  { id: 'gravy', color: '#d97706', label: 'Gravy', lightColor: '#fcd34d', darkColor: '#92400e' },
  { id: 'cheese', color: '#fbbf24', label: 'Cheese', lightColor: '#fde68a', darkColor: '#b45309' },
];

interface NoodleBase {
    id: number;
    start: {x: number, y: number};
    end: {x: number, y: number};
    cp1: {x: number, y: number};
    cp2: {x: number, y: number};
    width: number;
    phase: number;
    speed: number;
    colorOffset: number;
}

interface SprayParticle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    life: number;
}

interface FloatingIngredient {
    id: number;
    emoji: string;
    noodleIndex: number; // Attached to a specific noodle
    t: number; // Position along curve (0-1)
    offsetY: number;
    scale: number;
    shakePhase: number;
}

const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

export const StageFeeding: React.FC<StageFeedingProps> = ({ collectedIngredients, onComplete, videoStream }) => {
  // --- STATE ---
  const [visionReady, setVisionReady] = useState(false);
  const [visionError, setVisionError] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [renderTrigger, setRenderTrigger] = useState(0); 

  // --- REFS ---
  const selectedSauceRef = useRef<string>('ketchup'); // Default selection
  const activeColorsRef = useRef<string[]>(['#fcd34d']); // Start with base pasta color
  const isSprayingRef = useRef(false);
  const isMousePressingRef = useRef(false); // Track mouse state separately
  const mouthOpenRef = useRef(0);
  const monsterSizeRef = useRef(1);
  const feedProgressRef = useRef(0);
  const isCompleteRef = useRef(false);
  const squashFactorRef = useRef(0); // For bottle animation
  
  // Cursor Tracking
  const cursorScreenPosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const mousePosRef = useRef({ x: 0, y: 0 }); 
  const currentHandLandmarksRef = useRef<any[] | null>(null);
  const lastHandTimeRef = useRef(0); // For cursor stability
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(0);
  const timeRef = useRef(0);
  
  // Data Refs
  const sprayParticlesRef = useRef<SprayParticle[]>([]);
  const noodlesBaseRef = useRef<NoodleBase[]>([]);
  const embeddedIngredientsRef = useRef<FloatingIngredient[]>([]);

  // Vision Refs
  const lastVisionTimeRef = useRef(0);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

  // 0. Handle Resize
  useEffect(() => {
      const handleResize = () => {
          setDimensions({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Setup Vision
  useEffect(() => {
    let isMounted = true;
    const setupVision = async () => {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            
            if (!isMounted) return;

            const [faceLandmarker, handLandmarker] = await Promise.all([
                FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                }),
                HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 1
                })
            ]);

            if (isMounted) {
                faceLandmarkerRef.current = faceLandmarker;
                handLandmarkerRef.current = handLandmarker;
                setVisionReady(true);
            }
        } catch (e) {
            console.error("Vision Load Error:", e);
            if (isMounted) setVisionError(true);
        }
    };
    setupVision();
    return () => { isMounted = false; };
  }, []);

  // 2. Bind Video Stream
  useEffect(() => {
    if (videoRef.current && videoStream) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
        };
    }
  }, [videoStream]);

  // 3. Initialize Noodles & Embedded Ingredients
  useEffect(() => {
    const count = 180; 
    const bases: NoodleBase[] = [];
    const radius = 90; 

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius * 0.95;
        const cx = Math.cos(angle) * r;
        const cy = Math.sin(angle) * r;
        const spread = 400;

        bases.push({
            id: i,
            start: {x: cx + (Math.random()-0.5)*50, y: cy + (Math.random()-0.5)*50},
            end: {x: cx + (Math.random()-0.5)*50, y: cy + (Math.random()-0.5)*50},
            cp1: {x: cx + (Math.random()-0.5)*spread, y: cy + (Math.random()-0.5)*spread},
            cp2: {x: cx + (Math.random()-0.5)*spread, y: cy + (Math.random()-0.5)*spread},
            width: 3 + Math.random() * 3, 
            phase: Math.random() * Math.PI * 2,
            speed: 0.01 + Math.random() * 0.02,
            colorOffset: Math.floor(Math.random() * 10)
        });
    }
    noodlesBaseRef.current = bases;

    const embedded: FloatingIngredient[] = [];
    const list = collectedIngredients.length > 0 ? collectedIngredients : ['🍅', '🍄', '🌿', '🥩', '🥓', '🍞'];
    
    // Create more ingredients for better distribution
    const totalIngredients = Math.max(list.length * 2, 20);
    
    for(let i=0; i<totalIngredients; i++) {
        const emoji = list[i % list.length];
        const noodleIdx = Math.floor(Math.random() * count);
        embedded.push({
            id: i,
            emoji: emoji,
            noodleIndex: noodleIdx,
            t: 0.1 + Math.random() * 0.8, // Distributed along 10% to 90% of curve
            offsetY: (Math.random() - 0.5) * 15,
            scale: 0.7 + Math.random() * 0.5,
            shakePhase: Math.random() * Math.PI * 2
        });
    }
    embeddedIngredientsRef.current = embedded;

  }, [collectedIngredients]);

  // 4. Main Game Loop
  const animate = useCallback(() => {
    if (!containerRef.current) return;
    const width = dimensions.width;
    const height = dimensions.height;
    const now = performance.now();

    timeRef.current += 1;

    // --- Vision Processing ---
    if (visionReady && videoRef.current && videoRef.current.readyState >= 2) {
         if (now - lastVisionTimeRef.current > 60) { // Faster update rate (60ms)
             lastVisionTimeRef.current = now;
             const video = videoRef.current;
             
             if (handLandmarkerRef.current) {
                 const result = handLandmarkerRef.current.detectForVideo(video, now);
                 if (result.landmarks && result.landmarks.length > 0) {
                     const hand = result.landmarks[0];
                     currentHandLandmarksRef.current = hand; 
                     lastHandTimeRef.current = now;

                     const px = (1 - hand[9].x) * width;
                     const py = hand[9].y * height;
                     
                     // Smooth Lerp
                     const lerp = 0.3;
                     cursorScreenPosRef.current.x += (px - cursorScreenPosRef.current.x) * lerp;
                     cursorScreenPosRef.current.y += (py - cursorScreenPosRef.current.y) * lerp;
                     
                     mousePosRef.current = {
                         x: (cursorScreenPosRef.current.x / width) * 2 - 1,
                         y: -(cursorScreenPosRef.current.y / height) * 2 + 1
                     };

                     const thumbTip = hand[4];
                     const indexTip = hand[8];
                     const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                     // Hand pinch overrides
                     isSprayingRef.current = dist < 0.1; 
                 } else {
                     currentHandLandmarksRef.current = null;
                 }
             }

             if (faceLandmarkerRef.current) {
                 const result = faceLandmarkerRef.current.detectForVideo(video, now);
                 if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
                     const shapes = result.faceBlendshapes[0].categories;
                     const jawOpen = shapes.find(s => s.categoryName === 'jawOpen')?.score || 0;
                     mouthOpenRef.current += (jawOpen - mouthOpenRef.current) * 0.3;
                 }
             }
         }
    }

    // Logic to merge mouse and hand input state for spraying
    if (isMousePressingRef.current) {
        isSprayingRef.current = true;
    } else if (!currentHandLandmarksRef.current) {
        // Only reset if hand isn't controlling it
        isSprayingRef.current = false;
    }
    
    // Bottle Squash Animation Logic
    if (isSprayingRef.current) {
        squashFactorRef.current += (0.15 - squashFactorRef.current) * 0.2;
    } else {
        squashFactorRef.current += (0 - squashFactorRef.current) * 0.2;
    }

    // --- Hover Selection ---
    if (timeRef.current % 5 === 0) {
        const elem = document.elementFromPoint(cursorScreenPosRef.current.x, cursorScreenPosRef.current.y);
        const sauceBtn = elem?.closest('button[data-sauce-id]');
        if (sauceBtn) {
            const id = sauceBtn.getAttribute('data-sauce-id');
            if (id && id !== selectedSauceRef.current) {
                selectedSauceRef.current = id;
            }
        }
    }

    // --- Spraying ---
    if (isSprayingRef.current && selectedSauceRef.current) {
        const sauce = SAUCES.find(s => s.id === selectedSauceRef.current);
        if (sauce) {
            // FIXED: Nozzle is fixed at bottom center (tip of the bottle)
            const nozzleX = width / 2;
            const nozzleY = height - 165 + (squashFactorRef.current * 20); // Move with squash
            
            // Trigger SFX periodically while spraying
            if (timeRef.current % 12 === 0) { // Slightly slower trigger
               audio.playSFX('spray');
            }

            for(let k=0; k<2; k++) { 
                sprayParticlesRef.current.push({
                    id: Math.random(),
                    x: nozzleX,
                    y: nozzleY,
                    vx: (Math.random() - 0.5) * 6,
                    vy: -15 - Math.random() * 5, 
                    size: 8 + Math.random() * 8,
                    color: sauce.color,
                    life: 1.0
                });
            }

            // More aggressive color history capture (Every 3 frames)
            if (timeRef.current % 3 === 0) {
                if (activeColorsRef.current.length < 80) {
                    activeColorsRef.current.push(sauce.color);
                } else {
                    activeColorsRef.current[Math.floor(Math.random() * activeColorsRef.current.length)] = sauce.color;
                }
            }

            if (feedProgressRef.current < 100) {
                feedProgressRef.current += 0.8;
            } else if (!isCompleteRef.current) {
                isCompleteRef.current = true;
                setTimeout(() => onComplete(activeColorsRef.current), 1500);
            }
        }
    }

    // --- Particles ---
    const gravity = 0.6;
    for (let i = sprayParticlesRef.current.length - 1; i >= 0; i--) {
        const p = sprayParticlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.life -= 0.02;

        const dx = p.x - (width / 2);
        const dy = p.y - (height / 2 - 50); 
        const dist = Math.sqrt(dx*dx + dy*dy);
        const hitRadius = 130 * monsterSizeRef.current; 
        
        if (dist < hitRadius && p.y < height / 2 + 50 && p.y > height / 2 - 150) {
             sprayParticlesRef.current.splice(i, 1);
             monsterSizeRef.current = Math.min(monsterSizeRef.current + 0.003, 1.8); 
             continue;
        }

        if (p.life <= 0 || p.y > height) {
            sprayParticlesRef.current.splice(i, 1);
        }
    }

    setRenderTrigger(t => t + 1);
    requestRef.current = requestAnimationFrame(animate);
  }, [visionReady, onComplete, dimensions]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const handleMouseMove = (e: React.MouseEvent) => {
      // Input Source Locking:
      // If hand was detected recently (< 500ms ago), ignore mouse to prevent jitter
      const now = performance.now();
      if (now - lastHandTimeRef.current < 500) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
          cursorScreenPosRef.current.x = e.clientX - rect.left;
          cursorScreenPosRef.current.y = e.clientY - rect.top;
          mousePosRef.current = {
              x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
              y: -((e.clientY - rect.top) / rect.height) * 2 + 1
          };
      }
  };

  const handleMouseDown = () => { isMousePressingRef.current = true; };
  const handleMouseUp = () => { isMousePressingRef.current = false; };

  // Calculate Bezier Point
  const getBezierPoint = (t: number, p0: any, cp1: any, cp2: any, p3: any) => {
      const mt = 1-t;
      const mt2 = mt*mt;
      const t2 = t*t;
      return {
          x: mt2*mt*p0.x + 3*mt2*t*cp1.x + 3*mt*t2*cp2.x + t2*t*p3.x,
          y: mt2*mt*p0.y + 3*mt2*t*cp1.y + 3*mt*t2*cp2.y + t2*t*p3.y
      };
  };

  const renderNoodle3D = (base: NoodleBase, i: number) => {
      const t = timeRef.current * base.speed + base.phase;
      
      const wiggleX = Math.sin(t) * 15 + Math.cos(t*0.5)*10;
      const wiggleY = Math.cos(t * 1.2) * 15 + Math.sin(t*0.8)*10;
      
      const mx = mousePosRef.current.x * 20;
      const my = -mousePosRef.current.y * 20;

      const colorIndex = (i + base.colorOffset) % activeColorsRef.current.length;
      const baseColor = activeColorsRef.current[colorIndex];

      const p0 = { x: base.start.x + wiggleX + mx, y: base.start.y + wiggleY + my };
      const cp1 = { x: base.cp1.x + wiggleX, y: base.cp1.y + wiggleY };
      const cp2 = { x: base.cp2.x - wiggleX, y: base.cp2.y - wiggleY };
      const p3 = { x: base.end.x - wiggleX + mx, y: base.end.y - wiggleY + my };

      const pathD = `M ${p0.x} ${p0.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p3.x} ${p3.y}`;

      return (
          <g key={base.id}>
            <path
                d={pathD}
                stroke="rgba(0,0,0,0.15)"
                strokeWidth={base.width + 2}
                fill="none"
                strokeLinecap="round"
                transform="translate(2, 4)"
            />
            <path
                d={pathD}
                stroke={baseColor}
                strokeWidth={base.width}
                fill="none"
                strokeLinecap="round"
                style={{ transition: 'stroke 0.5s ease' }}
            />
            <path
                d={pathD}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={base.width * 0.4}
                fill="none"
                strokeLinecap="round"
                transform="translate(-1, -2)"
                style={{ mixBlendMode: 'screen' }}
            />
            
            {/* Embedded Ingredients Logic */}
            {embeddedIngredientsRef.current
                .filter(ing => ing.noodleIndex === i)
                .map(ing => {
                    const pos = getBezierPoint(ing.t, p0, cp1, cp2, p3);
                    
                    // Independent shake
                    const shakeX = Math.sin(timeRef.current * 0.5 + ing.shakePhase) * 3;
                    const shakeY = Math.cos(timeRef.current * 0.6 + ing.shakePhase) * 3;

                    return (
                        <text
                            key={`ing-${ing.id}`}
                            x={pos.x + shakeX}
                            y={pos.y + ing.offsetY + shakeY}
                            fontSize={20 * ing.scale}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${Math.sin(t + ing.id)*20}, ${pos.x}, ${pos.y})`}
                            style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))', pointerEvents: 'none' }}
                        >
                            {ing.emoji}
                        </text>
                    );
                })
            }
          </g>
      );
  };

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const monsterY = centerY - 50; 
  const currentSauce = SAUCES.find(s => s.id === selectedSauceRef.current) || SAUCES[0];

  // --- RENDER CURSOR ---
  const renderCursor = () => {
    // FIX: Always render cursor regardless of hand presence
    const x = cursorScreenPosRef.current.x;
    const y = cursorScreenPosRef.current.y;
    const isGrab = isSprayingRef.current;
    
    // Hand Skeleton Overlay (Only if detected)
    const hand = currentHandLandmarksRef.current;
    
    // Scale factor for drawing skeleton relative to cursor center
    const scaleFactor = 50; 
    let skeletonLines = null;
    let skeletonJoints = null;

    if (hand) {
        const centerNode = hand[9];
        const getDrawX = (val: number) => x + ((1-val) - (1-centerNode.x)) * scaleFactor * 3;
        const getDrawY = (val: number) => y + (val - centerNode.y) * scaleFactor * 3;
        const color = isGrab ? '#ef4444' : '#fbbf24';

        skeletonLines = HAND_CONNECTIONS.map((conn, idx) => (
            <line 
                key={idx}
                x1={getDrawX(hand[conn.start].x)} y1={getDrawY(hand[conn.start].y)}
                x2={getDrawX(hand[conn.end].x)} y2={getDrawY(hand[conn.end].y)}
                stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.6"
            />
        ));
        skeletonJoints = hand.map((lm: any, idx: number) => (
             <circle key={idx} cx={getDrawX(lm.x)} cy={getDrawY(lm.y)} r="3" fill={color} opacity="0.8" />
        ));
    }

    return (
        <g style={{ pointerEvents: 'none' }}>
             {/* Skeleton Layer */}
             {skeletonLines}
             {skeletonJoints}

             {/* Emoji Layer - Always Visible */}
             <g transform={`translate(${x}, ${y})`}>
                 <text y="-40" fontSize="40" textAnchor="middle" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>👨‍🍳</text>
                 <text y="10" fontSize="40" textAnchor="middle" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>
                     {isGrab ? '✊' : '✋'}
                 </text>
             </g>
        </g>
    );
  };

  return (
    <div 
        ref={containerRef} 
        className="relative w-full h-full bg-[#1c1917] cursor-none overflow-hidden touch-none"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
    >
      <video ref={videoRef} className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" autoPlay playsInline muted />
      
      <svg width="0" height="0" className="absolute">
          <defs>
              <radialGradient id="gradMouth" cx="50%" cy="50%" r="50%">
                  <stop offset="60%" stopColor="#450a0a" />
                  <stop offset="100%" stopColor="#7f1d1d" />
              </radialGradient>
              <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
                <feOffset dx="2" dy="4" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.3"/>
                </feComponentTransfer>
                <feMerge> 
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/> 
                </feMerge>
              </filter>
              <clipPath id="mouthClip">
                 <ellipse 
                    cx="0" cy="20" 
                    rx={60 + mouthOpenRef.current * 20} ry={20 + mouthOpenRef.current * 60} 
                 />
              </clipPath>
          </defs>
      </svg>

      <div className="absolute top-0 left-0 w-full flex flex-col items-center z-40 pointer-events-none">
          <div className="bg-black/50 backdrop-blur text-white/80 px-6 py-2 rounded-b-xl border border-white/10 text-sm font-mono tracking-wide mb-6">
            Move Mouse / Hand to Feed
          </div>

          <div className="flex flex-col items-center gap-3">
             <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 shadow-lg flex items-center gap-3">
                <span className="text-white font-bold text-lg handwritten tracking-wide drop-shadow-md">
                    😮 Open Mouth • ✊ Pinch to Spray
                </span>
             </div>

             <div className="w-64 h-5 bg-gray-800 rounded-full border-2 border-gray-600 overflow-hidden relative shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 transition-all duration-300"
                  style={{ width: `${feedProgressRef.current}%` }}
                />
             </div>
          </div>
      </div>

      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        {/* PARTICLES LAYER */}
        <g>
            {sprayParticlesRef.current.map(p => (
                <circle key={p.id} cx={p.x} cy={p.y} r={p.size} fill={p.color} opacity={0.9} />
            ))}
        </g>

        {/* MONSTER LAYER */}
        <g transform={`translate(${centerX}, ${monsterY}) scale(${monsterSizeRef.current})`}>
             <g filter="url(#softShadow)"> 
                {noodlesBaseRef.current.map((n, i) => renderNoodle3D(n, i))}
             </g>

             <g transform="translate(0, 20) scale(0.7)">
                <ellipse 
                    cx="0" cy="20" 
                    rx={60 + mouthOpenRef.current * 20} ry={20 + mouthOpenRef.current * 60} 
                    fill="url(#gradMouth)" stroke="#3f0808" strokeWidth="4" 
                />
                
                <g clipPath="url(#mouthClip)">
                    <path 
                        d={`M -40 ${-5 - mouthOpenRef.current * 10} Q 0 ${10 - mouthOpenRef.current * 5} 40 ${-5 - mouthOpenRef.current * 10}`} 
                        fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"
                    />
                </g>

                <g transform="translate(-50, -50)">
                   <circle r="32" fill="white" />
                   <circle cx={mousePosRef.current.x * 12} cy={-mousePosRef.current.y * 12} r={14 + (isSprayingRef.current ? 4 : 0)} fill="#1e293b" />
                   <circle cx={mousePosRef.current.x * 12 - 6} cy={-mousePosRef.current.y * 12 - 6} r="5" fill="white" opacity="0.9" />
                   
                   <path 
                     d={`M -35 ${-40 - mouthOpenRef.current*20} Q 0 ${-50 + mousePosRef.current.y*20} 35 ${-40 - mouthOpenRef.current*20}`} 
                     stroke="rgba(0,0,0,0.5)" strokeWidth="10" fill="none" strokeLinecap="round"
                     transform={`rotate(${mousePosRef.current.x * 20}) translate(2,4)`}
                   />
                   <path 
                     d={`M -35 ${-40 - mouthOpenRef.current*20} Q 0 ${-50 + mousePosRef.current.y*20} 35 ${-40 - mouthOpenRef.current*20}`} 
                     stroke="#000" strokeWidth="7" fill="none" strokeLinecap="round"
                     transform={`rotate(${mousePosRef.current.x * 20})`}
                   />
                </g>

                <g transform="translate(50, -50)">
                   <circle r="32" fill="white" />
                   <circle cx={mousePosRef.current.x * 12} cy={-mousePosRef.current.y * 12} r={14 + (isSprayingRef.current ? 4 : 0)} fill="#1e293b" />
                   <circle cx={mousePosRef.current.x * 12 - 6} cy={-mousePosRef.current.y * 12 - 6} r="5" fill="white" opacity="0.9" />

                   <path 
                     d={`M -35 ${-40 - mouthOpenRef.current*20} Q 0 ${-50 - mousePosRef.current.y*20} 35 ${-40 - mouthOpenRef.current*20}`} 
                     stroke="rgba(0,0,0,0.5)" strokeWidth="10" fill="none" strokeLinecap="round"
                     transform={`rotate(${-mousePosRef.current.x * 20}) translate(2,4)`}
                   />
                   <path 
                     d={`M -35 ${-40 - mouthOpenRef.current*20} Q 0 ${-50 - mousePosRef.current.y*20} 35 ${-40 - mouthOpenRef.current*20}`} 
                     stroke="#000" strokeWidth="7" fill="none" strokeLinecap="round"
                     transform={`rotate(${-mousePosRef.current.x * 20})`}
                   />
                </g>
             </g>
        </g>
        
        {/* UI & CONTROLS LAYER */}
        <g>
             {/* BOTTLE VISUAL */}
             <g transform={`translate(${centerX}, ${dimensions.height})`}>
                 <g transform={`translate(0, -20) scale(${1 + squashFactorRef.current * 0.1}, ${1 - squashFactorRef.current * 0.15})`}>
                    {/* Bottle Shadow */}
                    <ellipse cx="0" cy="10" rx="40" ry="10" fill="rgba(0,0,0,0.5)" />
                    
                    {/* Bottle Body */}
                    <path 
                        d="M -30 -120 C -35 -80 -40 -40 -35 0 L 35 0 C 40 -40 35 -80 30 -120 Q 15 -145 0 -145 Q -15 -145 -30 -120"
                        fill={currentSauce.color}
                        stroke="rgba(255,255,255,0.2)" strokeWidth="2"
                    />
                    
                    {/* Glossy Highlights */}
                    <path d="M -20 -110 Q -25 -60 -20 -20" stroke="rgba(255,255,255,0.5)" strokeWidth="5" fill="none" strokeLinecap="round" />
                    <path d="M 15 -120 Q 20 -80 15 -40" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" strokeLinecap="round" />

                    {/* Label Area */}
                    <g transform="translate(0, -60)">
                        <rect x="-28" y="-20" width="56" height="40" fill="white" rx="4" opacity="0.95" />
                        <text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="bold" fontFamily="sans-serif" fill="#333">
                            {currentSauce.label}
                        </text>
                        <rect x="-28" y="-20" width="56" height="5" fill={currentSauce.darkColor} />
                        <rect x="-28" y="15" width="56" height="5" fill={currentSauce.darkColor} />
                    </g>

                    {/* Cap and Nozzle */}
                    <rect x="-18" y="-145" width="36" height="20" fill="#262626" rx="3" />
                    <rect x="-18" y="-130" width="36" height="2" fill="#404040" />
                    <path d="M -6 -145 L -4 -160 L 4 -160 L 6 -145 Z" fill="#262626" />
                 </g>
             </g>

             {/* SAUCE BUTTONS (Side Columns) */}
             <g transform={`translate(${centerX}, ${dimensions.height - 100})`}>
                 {/* Left Column */}
                 <g transform="translate(-100, -30)">
                    {SAUCES.slice(0, 3).map((s, i) => {
                        const isSelected = selectedSauceRef.current === s.id;
                        return (
                            <foreignObject key={s.id} x="-28" y={i * 70 - 70} width="56" height="56" style={{overflow:'visible'}}>
                                <button
                                    data-sauce-id={s.id}
                                    className={`w-14 h-14 rounded-full border-2 shadow-lg transition-all duration-200 pointer-events-auto flex items-center justify-center
                                        ${isSelected ? 'scale-125 ring-4 ring-white z-10' : 'scale-100 opacity-90 hover:scale-110'}
                                    `}
                                    style={{ 
                                        backgroundColor: s.color,
                                        borderColor: s.lightColor,
                                        boxShadow: isSelected ? `0 0 20px ${s.color}` : '0 4px 6px rgba(0,0,0,0.4)'
                                    }}
                                >
                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full animate-ping" />}
                                </button>
                            </foreignObject>
                        );
                    })}
                 </g>

                 {/* Right Column */}
                 <g transform="translate(100, -30)">
                    {SAUCES.slice(3, 6).map((s, i) => {
                        const isSelected = selectedSauceRef.current === s.id;
                        return (
                             <foreignObject key={s.id} x="-28" y={i * 70 - 70} width="56" height="56" style={{overflow:'visible'}}>
                                <button
                                    data-sauce-id={s.id}
                                    className={`w-14 h-14 rounded-full border-2 shadow-lg transition-all duration-200 pointer-events-auto flex items-center justify-center
                                        ${isSelected ? 'scale-125 ring-4 ring-white z-10' : 'scale-100 opacity-90 hover:scale-110'}
                                    `}
                                    style={{ 
                                        backgroundColor: s.color,
                                        borderColor: s.lightColor,
                                        boxShadow: isSelected ? `0 0 20px ${s.color}` : '0 4px 6px rgba(0,0,0,0.4)'
                                    }}
                                >
                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full animate-ping" />}
                                </button>
                            </foreignObject>
                        );
                    })}
                 </g>
             </g>
        </g>
        
        {renderCursor()}
      </svg>
    </div>
  );
};
