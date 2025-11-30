
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import { audio } from '../utils/audio';

interface StageFeedingProps {
  collectedIngredients: string[];
  onComplete: (finalColors: string[]) => void;
  videoStream: MediaStream | null;
}

const SAUCES = [
  { id: 'ketchup', color: '#ef4444', label: 'Tomato', emoji: '🍅', lightColor: '#fecaca', darkColor: '#991b1b' },
  { id: 'cream', color: '#f3f4f6', label: 'Cream', emoji: '🥛', lightColor: '#ffffff', darkColor: '#d1d5db' },
  { id: 'pesto', color: '#22c55e', label: 'Pesto', emoji: '🌿', lightColor: '#86efac', darkColor: '#15803d' },
  { id: 'cheese', color: '#fbbf24', label: 'Cheese', emoji: '🧀', lightColor: '#fde68a', darkColor: '#b45309' },
  { id: 'gravy', color: '#d97706', label: 'Gravy', emoji: '🍖', lightColor: '#fcd34d', darkColor: '#92400e' },
  { id: 'mystery', color: '#a855f7', label: 'Mystery', emoji: '✨', lightColor: '#e9d5ff', darkColor: '#6b21a8' }, // Moved to last
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

interface SoundBubble {
    id: number;
    x: number;
    y: number;
    text: string;
    life: number;
    scale: number;
    vx: number;
    vy: number;
    rot: number;
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
  const soundBubblesRef = useRef<SoundBubble[]>([]);

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
            } else {
                faceLandmarker.close();
                handLandmarker.close();
            }
        } catch (e) {
            console.error("Vision Load Error:", e);
            if (isMounted) setVisionError(true);
        }
    };
    setupVision();
    return () => { 
        isMounted = false; 
        faceLandmarkerRef.current?.close();
        handLandmarkerRef.current?.close();
    };
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
    // Reduced count from 180 to 100 for better performance
    const count = 100; 
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
             
             try {
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
             } catch(e) {
                 console.warn("Vision detection error", e);
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

    // --- Hover Selection (Left Palette) ---
    if (timeRef.current % 5 === 0) {
        // Re-calculate hover for UI elements on left
        const elem = document.elementFromPoint(cursorScreenPosRef.current.x, cursorScreenPosRef.current.y);
        const sauceBtn = elem?.closest('button[data-sauce-id]');
        if (sauceBtn) {
            const id = sauceBtn.getAttribute('data-sauce-id');
            if (id && id !== selectedSauceRef.current) {
                selectedSauceRef.current = id;
            }
        }
    }

    // --- Mouth Sound Bubbles ---
    if (mouthOpenRef.current > 0.4 && timeRef.current % 12 === 0 && Math.random() > 0.2) {
        const noises = [
            "Delish!", "Spicy!", "More Salt!", "Chef Kiss!", 
            "Al Dente!", "Savory!", "Hot!", "Yummy!", 
            "More Sauce!", "Tasty!", "Mmm!", "Perfect!"
        ];
        soundBubblesRef.current.push({
            id: Math.random(),
            x: width / 2 + (Math.random() - 0.5) * 120, // Tighter
            y: height / 2 - 40, // Start higher
            text: noises[Math.floor(Math.random() * noises.length)],
            life: 1.0,
            scale: 0.1, // Start tiny
            vx: (Math.random() - 0.5) * 4,
            vy: -8 - Math.random() * 4, // Fast pop upward
            rot: (Math.random() - 0.5) * 20
        });
    }

    // Update Bubbles
    for (let i = soundBubblesRef.current.length - 1; i >= 0; i--) {
        const b = soundBubblesRef.current[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life -= 0.012; // slightly slower fade
        b.scale = Math.min(b.scale + 0.1, 1.0); // Fast pop in
        b.rot += b.vx * 0.5;
        if (b.life <= 0) soundBubblesRef.current.splice(i, 1);
    }

    // --- Spraying ---
    if (isSprayingRef.current && selectedSauceRef.current) {
        const sauce = SAUCES.find(s => s.id === selectedSauceRef.current);
        if (sauce) {
            const nozzleX = width / 2;
            const nozzleY = height - 165 + (squashFactorRef.current * 20) + 40; 
            
            if (timeRef.current % 12 === 0) { 
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
                 onComplete(activeColorsRef.current);
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
        const dy = p.y - (height / 2); 
        const dist = Math.sqrt(dx*dx + dy*dy);
        const hitRadius = 130 * monsterSizeRef.current; 
        
        if (dist < hitRadius && p.y < height / 2 + 100 && p.y > height / 2 - 100) {
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

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      // Input Source Locking:
      // If hand was detected recently (< 500ms ago), ignore mouse to prevent jitter
      const now = performance.now();
      if (now - lastHandTimeRef.current < 500) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
          let clientX, clientY;
          if ('touches' in e) {
             clientX = e.touches[0].clientX;
             clientY = e.touches[0].clientY;
          } else {
             clientX = (e as React.MouseEvent).clientX;
             clientY = (e as React.MouseEvent).clientY;
          }
          
          cursorScreenPosRef.current.x = clientX - rect.left;
          cursorScreenPosRef.current.y = clientY - rect.top;
          mousePosRef.current = {
              x: ((clientX - rect.left) / rect.width) * 2 - 1,
              y: -((clientY - rect.top) / rect.height) * 2 + 1
          };
      }
  };

  const handleMouseDown = () => { isMousePressingRef.current = true; };
  const handleMouseUp = () => { isMousePressingRef.current = false; };
  
  // Use Window listeners for mouse up to prevent sticky state
  useEffect(() => {
      const globalUp = () => { isMousePressingRef.current = false; };
      window.addEventListener('mouseup', globalUp);
      window.addEventListener('touchend', globalUp);
      return () => {
          window.removeEventListener('mouseup', globalUp);
          window.removeEventListener('touchend', globalUp);
      };
  }, []);

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
  const monsterY = centerY - 20; // Lowered slightly
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

             {/* Cursor Main Elements */}
             <g transform={`translate(${x}, ${y})`}>
                 {/* Chef Hat - Moved higher to match Cooking stage */}
                 <text y="-35" fontSize="30" textAnchor="middle" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>👨‍🍳</text>
                 
                 {/* Only show hand emoji if no skeleton detected */}
                 {!hand && (
                    <text y="0" fontSize="40" textAnchor="middle" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>
                        {isGrab ? '✊' : '✋'}
                    </text>
                 )}
             </g>
        </g>
    );
  };

  return (
    <div 
        ref={containerRef} 
        className="relative w-full h-full cursor-none overflow-hidden touch-none transition-colors duration-0 bg-[#1c1917]"
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
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
              {/* Refined Bubble Gradient - Glossy & Glassy */}
              <radialGradient id="bubbleGradNew" cx="30%" cy="30%" r="80%" fx="30%" fy="30%">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
                  <stop offset="20%" stopColor="rgba(240, 240, 255, 0.6)" />
                  <stop offset="100%" stopColor="rgba(200, 220, 255, 0.2)" />
              </radialGradient>
              <filter id="bubbleGlow">
                   <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                   <feComposite in="blur" in2="SourceGraphic" operator="over" />
              </filter>
          </defs>
      </svg>

      {/* Cloud Bubble above Monster */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 pointer-events-none z-40 animate-float-slow">
        <div className="relative bg-white text-black px-8 py-5 rounded-[60px] shadow-xl border-4 border-black max-w-sm text-center">
            <p className="font-['Gochi_Hand'] text-xl font-bold leading-tight">
                Open your mouth to feed me!! <br/>
                Move your hand to the sauce bottle, clench to squeezeeeeee!
            </p>
            {/* Cloud Tail */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[20px] border-t-black"></div>
            <div className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[16px] border-t-white"></div>
        </div>
      </div>

      {/* Pixel Monster & Guide Bubble (Bottom Right of Center) */}
      <div className="absolute bottom-4 left-[55%] z-40 flex items-end gap-2 pointer-events-none animate-bounce-gentle">
          {/* Pixel Monster */}
          <div className="relative w-16 h-16 transform scale-x-[-1]">
              <svg viewBox="0 0 16 16" className="w-full h-full drop-shadow-lg" shapeRendering="crispEdges">
                  <path d="M4 2h8v1h2v2h1v6h-1v2h-2v1h-8v-1h-2v-2h-1v-6h1v-2h2v-1z" fill="#000" />
                  <path d="M4 3h8v1h1v2h1v6h-1v1h-1v1h-8v-1h-1v-1h-1v-6h1v-2h1v-1z" fill="#fcd34d" />
                  <rect x="3" y="5" width="2" height="1" fill="#ef4444" />
                  <rect x="11" y="6" width="1" height="2" fill="#ef4444" />
                  <rect x="6" y="11" width="3" height="1" fill="#ef4444" />
                  <rect x="10" y="3" width="1" height="1" fill="#ef4444" />
                  <rect x="5" y="5" width="2" height="2" fill="#fff" />
                  <rect x="6" y="6" width="1" height="1" fill="#000" />
                  <rect x="9" y="5" width="2" height="2" fill="#fff" />
                  <rect x="9" y="6" width="1" height="1" fill="#000" />
              </svg>
          </div>
          {/* Guide Bubble */}
          <div className="relative bg-white text-black px-4 py-3 rounded-xl rounded-bl-none border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.2)] mb-8 max-w-[200px]">
              <p className="font-mono text-xs font-bold uppercase leading-snug">
                  you can change the sauce on the left, try your favourite flavour!
              </p>
          </div>
      </div>

      {/* Progress Bar - Repositioned to Top */}
      <div className="absolute top-6 left-0 w-full flex justify-center pointer-events-none z-30">
         <div className="w-64 h-5 bg-gray-800 rounded-full border-2 border-gray-600 overflow-hidden relative shadow-inner">
            <div 
              className={`h-full transition-all duration-300 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500`}
              style={{ width: `${feedProgressRef.current}%` }}
            />
         </div>
      </div>

      {/* LEFT PALETTE UI */}
      <div className="absolute left-10 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-10 p-4 bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-yellow-500/30 shadow-[0_0_30px_rgba(0,0,0,0.5)] transform -rotate-1">
         {/* Palette Header */}
         <div className="text-center text-xs text-yellow-500 font-mono tracking-widest uppercase mb-1 opacity-70">
            SAUCES
         </div>
         {SAUCES.map((s) => {
             const isSelected = selectedSauceRef.current === s.id;
             return (
                 <button
                     key={s.id}
                     data-sauce-id={s.id}
                     className={`w-14 h-14 rounded-full border-2 shadow-lg transition-all duration-200 pointer-events-auto flex items-center justify-center relative group text-2xl
                         ${isSelected ? 'scale-110 ring-4 ring-white z-10' : 'scale-95 opacity-80 hover:scale-105 hover:opacity-100'}
                     `}
                     style={{ 
                         backgroundColor: s.color,
                         borderColor: s.lightColor,
                         boxShadow: isSelected ? `0 0 20px ${s.color}` : '0 2px 4px rgba(0,0,0,0.5)'
                     }}
                 >
                     {isSelected && <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-30" />}
                     <span className="filter drop-shadow-sm transform group-hover:scale-110 transition-transform">{s.emoji}</span>
                     
                     {/* Tooltip */}
                     <span className="absolute left-full ml-5 bg-black/90 text-white text-sm px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/20 font-bold">
                         {s.label}
                     </span>
                 </button>
             );
         })}
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
                     stroke={'rgba(0,0,0,0.5)'} 
                     strokeWidth="10" fill="none" strokeLinecap="round"
                     transform={`rotate(${mousePosRef.current.x * 20}) translate(2,4)`}
                   />
                   <path 
                     d={`M -35 ${-40 - mouthOpenRef.current*20} Q 0 ${-50 + mousePosRef.current.y*20} 35 ${-40 - mouthOpenRef.current*20}`} 
                     stroke={'#000'}
                     strokeWidth="7" fill="none" strokeLinecap="round"
                     transform={`rotate(${mousePosRef.current.x * 20})`}
                   />
                </g>

                <g transform="translate(50, -50)">
                   <circle r="32" fill="white" />
                   <circle cx={mousePosRef.current.x * 12} cy={-mousePosRef.current.y * 12} r={14 + (isSprayingRef.current ? 4 : 0)} fill="#1e293b" />
                   <circle cx={mousePosRef.current.x * 12 - 6} cy={-mousePosRef.current.y * 12 - 6} r="5" fill="white" opacity="0.9" />

                   <path 
                     d={`M -35 ${-40 - mouthOpenRef.current*20} Q 0 ${-50 - mousePosRef.current.y*20} 35 ${-40 - mouthOpenRef.current*20}`} 
                     stroke={'rgba(0,0,0,0.5)'}
                     strokeWidth="10" fill="none" strokeLinecap="round"
                     transform={`rotate(${-mousePosRef.current.x * 20}) translate(2,4)`}
                   />
                   <path 
                     d={`M -35 ${-40 - mouthOpenRef.current*20} Q 0 ${-50 - mousePosRef.current.y*20} 35 ${-40 - mouthOpenRef.current*20}`} 
                     stroke={'#000'}
                     strokeWidth="7" fill="none" strokeLinecap="round"
                     transform={`rotate(${-mousePosRef.current.x * 20})`}
                   />
                </g>
             </g>
        </g>

        {/* SOUND BUBBLES - REDESIGNED: Quality UI, Cute, Bubble-like */}
        <g>
            {soundBubblesRef.current.map(b => (
                <g key={b.id} transform={`translate(${b.x}, ${b.y}) scale(${b.scale}) rotate(${b.rot})`}>
                    
                    {/* Main Bubble Shape - Glossy & Round */}
                    <circle r="32" fill="url(#bubbleGradNew)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" filter="url(#bubbleGlow)" />
                    
                    {/* Small attached bubbles (foam effect) */}
                    <circle cx="28" cy="15" r="8" fill="url(#bubbleGradNew)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
                    <circle cx="-25" cy="22" r="5" fill="url(#bubbleGradNew)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
                    
                    {/* Strong Gloss Reflection */}
                    <path d="M -15 -18 Q -20 -25 0 -25 Q 15 -25 10 -18" fill="rgba(255,255,255,0.9)" />
                    <circle cx="12" cy="-12" r="3" fill="white" opacity="0.8" />
                    
                    {/* Text content - Cute Font, Contrasting Color */}
                    <text 
                        x="0" y="5" 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                        fontFamily="'Gochi Hand', cursive" 
                        fontSize="20" 
                        fill="#1e3a8a" 
                        fontWeight="bold"
                        style={{ textShadow: '0px 1px 0px rgba(255,255,255,1)' }}
                    >
                        {b.text}
                    </text>
                </g>
            ))}
        </g>
        
        {/* BOTTLE VISUAL - Hide during breakdown */}
        <g transform={`translate(${centerX}, ${dimensions.height + 40})`}> {/* Lowered by 40 */}
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
                    <text x="0" y="5" textAnchor="middle" fontSize="16" fontWeight="bold" fontFamily="'Gochi Hand', cursive" fill="#4b5563">
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
      </svg>
      
      {/* CURSOR OVERLAY - On Top of Everything */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[60]">
        {renderCursor()}
      </svg>
      
      <style>{`
        @keyframes float-slow {
            0%, 100% { transform: translate(-50%, 0); }
            50% { transform: translate(-50%, -10px); }
        }
        .animate-float-slow {
            animation: float-slow 4s ease-in-out infinite;
        }
        @keyframes bounce-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        .animate-bounce-gentle {
            animation: bounce-gentle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
