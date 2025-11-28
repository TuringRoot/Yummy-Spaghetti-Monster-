import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

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
    x: number;
    y: number;
    angle: number;
    speed: number;
    radius: number;
}

const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

export const StageFeeding: React.FC<StageFeedingProps> = ({ collectedIngredients, onComplete, videoStream }) => {
  // --- STATE ---
  const [visionReady, setVisionReady] = useState(false);
  const [visionError, setVisionError] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [renderTrigger, setRenderTrigger] = useState(0); 

  // --- REFS ---
  const selectedSauceRef = useRef<string | null>(null);
  const activeColorsRef = useRef<string[]>(['#fcd34d']); // Start with base pasta color
  const isSprayingRef = useRef(false);
  const mouthOpenRef = useRef(0);
  const monsterSizeRef = useRef(1);
  const feedProgressRef = useRef(0);
  const isCompleteRef = useRef(false);
  const cursorScreenPosRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 }); 
  const currentHandLandmarksRef = useRef<any[] | null>(null);
  
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
    collectedIngredients.forEach((emoji, i) => {
        embedded.push({
            id: i,
            emoji: emoji,
            angle: Math.random() * Math.PI * 2,
            radius: Math.random() * 60,
            speed: (Math.random() - 0.5) * 0.02,
            x: 0,
            y: 0
        });
    });
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
         if (now - lastVisionTimeRef.current > 150) { 
             lastVisionTimeRef.current = now;
             const video = videoRef.current;
             
             if (handLandmarkerRef.current) {
                 const result = handLandmarkerRef.current.detectForVideo(video, now);
                 if (result.landmarks && result.landmarks.length > 0) {
                     const hand = result.landmarks[0];
                     currentHandLandmarksRef.current = hand; 

                     const px = (1 - hand[9].x) * width;
                     const py = hand[9].y * height;
                     
                     const lerp = 0.5;
                     cursorScreenPosRef.current.x += (px - cursorScreenPosRef.current.x) * lerp;
                     cursorScreenPosRef.current.y += (py - cursorScreenPosRef.current.y) * lerp;
                     
                     mousePosRef.current = {
                         x: (cursorScreenPosRef.current.x / width) * 2 - 1,
                         y: -(cursorScreenPosRef.current.y / height) * 2 + 1
                     };

                     const thumbTip = hand[4];
                     const indexTip = hand[8];
                     const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
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
            const nozzleX = width / 2;
            const nozzleY = height - 100;

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
                // Keep the color history manageable but allow mixing
                if (activeColorsRef.current.length < 80) {
                    activeColorsRef.current.push(sauce.color);
                } else {
                    // Replace a random existing color to keep it evolving
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

    embeddedIngredientsRef.current.forEach(ing => {
        ing.angle += ing.speed;
        ing.x = Math.cos(ing.angle) * ing.radius;
        ing.y = Math.sin(ing.angle) * ing.radius;
    });

    setRenderTrigger(t => t + 1);
    requestRef.current = requestAnimationFrame(animate);
  }, [visionReady, onComplete, dimensions]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const handleMouseMove = (e: React.MouseEvent) => {
      if (currentHandLandmarksRef.current) return;

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

  const handleMouseDown = () => { isSprayingRef.current = true; };
  const handleMouseUp = () => { isSprayingRef.current = false; };

  const renderNoodle3D = (base: NoodleBase, i: number) => {
      const t = timeRef.current * base.speed + base.phase;
      
      const wiggleX = Math.sin(t) * 15 + Math.cos(t*0.5)*10;
      const wiggleY = Math.cos(t * 1.2) * 15 + Math.sin(t*0.8)*10;
      
      const mx = mousePosRef.current.x * 20;
      const my = -mousePosRef.current.y * 20;

      const colorIndex = (i + base.colorOffset) % activeColorsRef.current.length;
      const baseColor = activeColorsRef.current[colorIndex];

      const pathD = `M ${base.start.x + wiggleX + mx} ${base.start.y + wiggleY + my} 
                     C ${base.cp1.x + wiggleX} ${base.cp1.y + wiggleY}, 
                       ${base.cp2.x - wiggleX} ${base.cp2.y - wiggleY}, 
                       ${base.end.x - wiggleX + mx} ${base.end.y - wiggleY + my}`;

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
          </g>
      );
  };

  const currentSauceId = selectedSauceRef.current;
  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const monsterY = centerY - 50; 

  const renderSkeleton = () => {
    const hand = currentHandLandmarksRef.current;
    if (!hand) return null;

    const centerNode = hand[9];
    const scaleFactor = 50; 

    const getDrawX = (val: number) => {
        const diff = (1 - val) - (1 - centerNode.x);
        return cursorScreenPosRef.current.x + diff * scaleFactor * 3;
    };
    const getDrawY = (val: number) => {
        const diff = val - centerNode.y;
        return cursorScreenPosRef.current.y + diff * scaleFactor * 3;
    };

    const color = isSprayingRef.current ? '#ef4444' : '#fbbf24';

    return (
        <g>
            <text x={cursorScreenPosRef.current.x + 10} y={cursorScreenPosRef.current.y - 30} fontSize="30">👨‍🍳</text>

            {HAND_CONNECTIONS.map((conn, idx) => {
                const start = hand[conn.start];
                const end = hand[conn.end];
                return (
                    <line 
                        key={idx}
                        x1={getDrawX(start.x)} y1={getDrawY(start.y)}
                        x2={getDrawX(end.x)} y2={getDrawY(end.y)}
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                );
            })}
            {hand.map((lm: any, idx: number) => (
                <circle 
                    key={idx}
                    cx={getDrawX(lm.x)} cy={getDrawY(lm.y)}
                    r="4"
                    fill={color}
                />
            ))}
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
              <radialGradient id="gradSkin" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#fef3c7" /> 
                  <stop offset="100%" stopColor="#d97706" />
              </radialGradient>
              <linearGradient id="gradMetal" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="50%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
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

             {!visionReady && !visionError && (
                <div className="bg-yellow-600/80 text-white px-4 py-1 rounded-full text-xs font-mono animate-pulse font-bold shadow-lg">
                    INITIALIZING VISION AI...
                </div>
             )}
          </div>
      </div>

      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <g>
            {sprayParticlesRef.current.map(p => (
                <circle key={p.id} cx={p.x} cy={p.y} r={p.size} fill={p.color} opacity={0.9} />
            ))}
        </g>

        <g transform={`translate(${centerX}, ${monsterY}) scale(${monsterSizeRef.current})`}>
             
             <g opacity={0.6}>
                {embeddedIngredientsRef.current.slice(0, embeddedIngredientsRef.current.length / 2).map((ing) => (
                    <text 
                        key={ing.id} 
                        x={ing.x} y={ing.y} 
                        fontSize={30} 
                        textAnchor="middle" 
                        dominantBaseline="central"
                        transform={`rotate(${Math.sin(timeRef.current * 0.05 + ing.id) * 20})`}
                    >
                        {ing.emoji}
                    </text>
                ))}
             </g>

             <g filter="url(#softShadow)"> 
                {noodlesBaseRef.current.map((n, i) => renderNoodle3D(n, i))}
             </g>

             <g opacity={0.9}>
                {embeddedIngredientsRef.current.slice(embeddedIngredientsRef.current.length / 2).map((ing) => (
                    <text 
                        key={ing.id} 
                        x={ing.x} y={ing.y} 
                        fontSize={32} 
                        textAnchor="middle" 
                        dominantBaseline="central"
                        transform={`rotate(${Math.sin(timeRef.current * 0.05 + ing.id) * 20})`}
                        style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.5))' }}
                    >
                        {ing.emoji}
                    </text>
                ))}
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
                   <circle cx={mousePosRef.current.x * 12 + 8} cy={-mousePosRef.current.y * 12 + 6} r="2" fill="white" opacity="0.6" />
                   
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
                   <circle cx={mousePosRef.current.x * 12 + 8} cy={-mousePosRef.current.y * 12 + 6} r="2" fill="white" opacity="0.6" />

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
        
        <g transform={`translate(${centerX}, ${dimensions.height - 60})`}>
            <path d="M -40 60 L -25 -20 L 25 -20 L 40 60 Z" fill="url(#gradMetal)" stroke="#475569" strokeWidth="2" />
            <path d="M -32 20 L 32 20" stroke="rgba(0,0,0,0.2)" strokeWidth="4" />
            <path d="M -25 -20 L -20 -30 L 20 -30 L 25 -20 Z" fill="#1e293b" />
            
            {isSprayingRef.current && (
                 <ellipse cx="0" cy="-35" rx="15" ry="5" fill="white" opacity="0.5" filter="blur(4px)" />
            )}
        </g>

        {renderSkeleton()}

      </svg>

      <div className="absolute bottom-6 left-0 w-full flex justify-center items-end pointer-events-none gap-24 md:gap-40 z-30">
         <div className="flex gap-3 md:gap-5 pointer-events-auto">
             {SAUCES.slice(0, 3).map((sauce) => (
                 <button
                    key={sauce.id}
                    data-sauce-id={sauce.id}
                    onClick={() => {selectedSauceRef.current = sauce.id; setRenderTrigger(t=>t+1)}}
                    className={`
                        relative w-20 h-24 md:w-28 md:h-32 rounded-3xl border-b-4 border-r-2 shadow-xl transition-all duration-200 ease-out
                        ${currentSauceId === sauce.id 
                            ? 'transform -translate-y-2 scale-110 ring-4 ring-white/80 z-10' 
                            : 'hover:scale-105 hover:-translate-y-1 opacity-90 hover:opacity-100'}
                    `}
                    style={{ 
                        backgroundColor: sauce.lightColor, 
                        borderColor: sauce.darkColor,
                        color: sauce.darkColor
                    }}
                 >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <div 
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full mb-1 border-2 border-black/5 shadow-inner" 
                            style={{backgroundColor: sauce.color}} 
                        />
                        <span className="font-bold text-[10px] md:text-xs handwritten uppercase tracking-widest">{sauce.label}</span>
                    </div>
                 </button>
             ))}
         </div>
         
         <div className="flex gap-3 md:gap-5 pointer-events-auto">
             {SAUCES.slice(3, 6).map((sauce) => (
                 <button
                    key={sauce.id}
                    data-sauce-id={sauce.id}
                    onClick={() => {selectedSauceRef.current = sauce.id; setRenderTrigger(t=>t+1)}}
                    className={`
                        relative w-20 h-24 md:w-28 md:h-32 rounded-3xl border-b-4 border-r-2 shadow-xl transition-all duration-200 ease-out
                        ${currentSauceId === sauce.id 
                            ? 'transform -translate-y-2 scale-110 ring-4 ring-white/80 z-10' 
                            : 'hover:scale-105 hover:-translate-y-1 opacity-90 hover:opacity-100'}
                    `}
                    style={{ 
                        backgroundColor: sauce.lightColor, 
                        borderColor: sauce.darkColor,
                        color: sauce.darkColor
                    }}
                 >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <div 
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full mb-1 border-2 border-black/5 shadow-inner" 
                            style={{backgroundColor: sauce.color}} 
                        />
                        <span className="font-bold text-[10px] md:text-xs handwritten uppercase tracking-widest">{sauce.label}</span>
                    </div>
                 </button>
             ))}
         </div>
      </div>
      
      {!currentHandLandmarksRef.current && (
        <div 
            className="fixed z-50 pointer-events-none transition-transform duration-75 ease-out"
            style={{
                left: 0,
                top: 0,
                transform: `translate(${cursorScreenPosRef.current.x}px, ${cursorScreenPosRef.current.y}px)`,
            }}
        >
            <div className="relative text-3xl">
                <span className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl">
                    {isSprayingRef.current ? '✊' : '✋'}
                </span>
                <span className="absolute -translate-x-1/2 -translate-y-[150%] text-2xl animate-bounce">
                    👨‍🍳
                </span>
            </div>
        </div>
      )}

    </div>
  );
};