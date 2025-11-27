import React, { useState, useEffect, useRef, useMemo } from 'react';

interface StageFeedingProps {
  collectedIngredients: string[];
  onComplete: (finalColors: string[]) => void;
}

const SAUCES = [
  { id: 'ketchup', color: '#ef4444', label: 'Tomato', lightColor: '#fca5a5' },
  { id: 'cream', color: '#f3f4f6', label: 'Cream', lightColor: '#ffffff' },
  { id: 'pesto', color: '#22c55e', label: 'Pesto', lightColor: '#86efac' },
  { id: 'mystery', color: '#9333ea', label: 'Mystery', lightColor: '#d8b4fe' },
  { id: 'gravy', color: '#78350f', label: 'Gravy', lightColor: '#b45309' },
  { id: 'cheese', color: '#f59e0b', label: 'Cheese', lightColor: '#fcd34d' },
];

interface NoodleStrand {
    path: string;
    width: number;
    zIndex: number;
}

interface BlobStain {
    id: number;
    d: string; 
    color: string;
    x: number;
    y: number;
    scale: number;
}

export const StageFeeding: React.FC<StageFeedingProps> = ({ collectedIngredients, onComplete }) => {
  const [selectedSauce, setSelectedSauce] = useState<string | null>(null);
  const [monsterSize, setMonsterSize] = useState(1);
  const [activeColors, setActiveColors] = useState<string[]>(['#fbbf24']); 
  const [isSpraying, setIsSpraying] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0); 
  const [isComplete, setIsComplete] = useState(false);
  const [sauceBlobs, setSauceBlobs] = useState<BlobStain[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [feedProgress, setFeedProgress] = useState(0);
  const requestRef = useRef<number>(0);
  const noodlesRef = useRef<NoodleStrand[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Pre-calculate 3D positions for ingredients using Fibonacci Sphere algorithm
  // This ensures they are evenly distributed around the monster ball
  const ingredientPositions = useMemo(() => {
      const positions = [];
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      const n = collectedIngredients.length;
      
      for (let i = 0; i < n; i++) {
          const theta = 2 * Math.PI * i / goldenRatio;
          const phi = Math.acos(1 - 2 * (i + 0.5) / n);
          
          const r = 110 + Math.random() * 20; // Radius slightly outside main body
          
          positions.push({
              x: r * Math.cos(theta) * Math.sin(phi),
              y: r * Math.sin(theta) * Math.sin(phi),
              z: r * Math.cos(phi),
              initialRotation: Math.random() * Math.PI * 2
          });
      }
      return positions;
  }, [collectedIngredients]);

  useEffect(() => {
      const strands: NoodleStrand[] = [];
      for (let i = 0; i < 400; i++) {
          const theta = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 95;
          const startX = 100 + r * Math.cos(theta);
          const startY = 100 + r * Math.sin(theta);
          const length = 15 + Math.random() * 25;
          const angle = Math.random() * Math.PI * 2;
          const endX = startX + Math.cos(angle) * length;
          const endY = startY + Math.sin(angle) * length;
          const cp1x = startX + (Math.random() - 0.5) * 50; // Increased chaos
          const cp1y = startY + (Math.random() - 0.5) * 50;
          const cp2x = endX + (Math.random() - 0.5) * 50;
          const cp2y = endY + (Math.random() - 0.5) * 50;
          strands.push({
              path: `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
              width: 1.0 + Math.random() * 2.0,
              zIndex: Math.random() 
          });
      }
      noodlesRef.current = strands;
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      setMouthOpen(prev => Math.min(1, Math.max(0, prev - e.deltaY * 0.001)));
    };
    const handleKey = (e: KeyboardEvent) => {
        if(e.code === 'ArrowUp' || e.code === 'Space') setMouthOpen(prev => Math.min(1, prev + 0.1));
        if(e.code === 'ArrowDown') setMouthOpen(prev => Math.max(0, prev - 0.1));
    };
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('keydown', handleKey);
    return () => {
        window.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleKey);
    }
  }, []);

  useEffect(() => {
    const animate = () => {
      setTime(t => t + 0.05);

      if (isSpraying && selectedSauce && mouthOpen > 0.2 && !isComplete) {
        setMonsterSize(prev => Math.min(2.5, prev + 0.003 * mouthOpen));
        setFeedProgress(prev => prev + 0.5 * mouthOpen);
        const sauce = SAUCES.find(s => s.id === selectedSauce);
        if (sauce) {
             if (Math.random() > 0.90) {
                 setActiveColors(prev => [sauce.color, ...prev].slice(0, 5));
             }
             if (Math.random() > 0.8) {
                 const p = `M 0 0 Q ${5+Math.random()*10} ${-5-Math.random()*10} 10 0 T 20 0`;
                 setSauceBlobs(prev => [
                     ...prev, 
                     { id: Date.now()+Math.random(), d: p, x: 50+Math.random()*100, y: 50+Math.random()*100, color: sauce.color, scale: 0.5+Math.random() }
                 ].slice(-30)); 
             }
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [isSpraying, selectedSauce, mouthOpen, isComplete]);

  useEffect(() => {
      if (feedProgress >= 100 && !isComplete) {
          setIsComplete(true);
          onComplete(activeColors);
      }
  }, [feedProgress, onComplete, activeColors, isComplete]);

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      // Normalized -1 to 1
      const x = (e.clientX - rect.left - centerX) / (rect.width / 2);
      const y = (e.clientY - rect.top - centerY) / (rect.height / 2);
      setMousePos({ x, y });
  };

  // Generate Organic Mouth Path
  const getMouthPath = (openness: number) => {
      const cx = 100;
      const cy = 130;
      const width = 30 + openness * 30;
      const height = 5 + openness * 60;
      
      const lipCurve = 5 + openness * 10;
      
      // Top Lip: Cupid's Bow style
      // M startX startY Q cp1x cp1y midX midY Q cp2x cp2y endX endY
      const topLipPath = `M ${cx - width/2} ${cy} 
                          Q ${cx - width/4} ${cy - lipCurve} ${cx} ${cy - height*0.2} 
                          Q ${cx + width/4} ${cy - lipCurve} ${cx + width/2} ${cy}`;
      
      // Bottom Lip: Round and full
      const bottomLipPath = `Q ${cx} ${cy + height} ${cx - width/2} ${cy}`;
      
      return `${topLipPath} ${bottomLipPath} Z`;
  };

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-full flex flex-col items-center justify-between p-4 bg-gradient-to-b from-gray-900 to-black/90 cursor-crosshair overflow-hidden"
        onMouseMove={handleMouseMove}
    >
      <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-50">
         <div className="bg-red-600/90 text-white font-bold px-6 py-1 rounded-b-xl shadow-lg animate-pulse tracking-wide text-sm md:text-base">
             ⬆️ SCROLL TO OPEN MOUTH • 🖱️ HOLD TO SQUEEZE SAUCE
         </div>
      </div>

      <div className="mt-8 text-center z-10 pointer-events-none">
        <h2 className="text-4xl handwritten text-white drop-shadow-md">Feed the Beast</h2>
      </div>

      <div className="relative flex-1 flex items-center justify-center w-full z-10">
        {isSpraying && mouthOpen > 0.2 && (
            <div className="absolute inset-0 pointer-events-none z-20">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="absolute rounded-full animate-ping"
                         style={{
                             left: '50%', top: '50%',
                             width: `${5 + Math.random() * 15}px`, height: `${5 + Math.random() * 15}px`,
                             backgroundColor: SAUCES.find(s => s.id === selectedSauce)?.color,
                             opacity: 0.8,
                             animationDuration: `${0.2 + Math.random() * 0.3}s`,
                             transform: `translate(${(Math.random()-0.5)*200}px, ${(Math.random()-0.5)*200}px)`
                         }}
                    />
                ))}
            </div>
        )}

        {/* Monster Container with heavy mouse tracking */}
        <div className="transition-transform duration-100 ease-out relative" 
             style={{ 
                 transform: `scale(${monsterSize}) rotateX(${mousePos.y * 25}deg) rotateY(${mousePos.x * 25}deg) translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)` 
             }}>
             <svg width="500" height="500" viewBox="0 0 200 200" className="overflow-visible">
                <defs>
                     <filter id="plastic" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="blur" />
                        <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1.2" specularExponent="25" lightingColor="#ffffff" result="specular">
                            <fePointLight x="-5000" y="-10000" z="20000" />
                        </feSpecularLighting>
                        <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular" />
                        <feComposite in="SourceGraphic" in2="specular" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
                        <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3"/>
                    </filter>
                    {/* No ClipPath - Free Blob */}
                    <radialGradient id="eyeGrad">
                        <stop offset="0%" stopColor="white"/>
                        <stop offset="85%" stopColor="#e2e8f0"/>
                        <stop offset="100%" stopColor="#94a3b8"/>
                    </radialGradient>
                </defs>
                
                {/* Body - Unconstrained Noodles */}
                <g filter="url(#plastic)">
                    {noodlesRef.current.map((n, i) => (
                        <path key={i} d={n.path} stroke={activeColors[i % activeColors.length]} strokeWidth={n.width} strokeLinecap="round" fill="none" transform={`translate(${Math.sin(time + i)*4.0}, ${Math.cos(time + i)*4.0})`}/>
                    ))}
                </g>
                <g>
                    {sauceBlobs.map((b) => (
                         <path key={b.id} d={b.d} fill={b.color} transform={`translate(${b.x}, ${b.y}) scale(${b.scale})`} opacity="0.9" style={{ mixBlendMode: 'multiply' }}/>
                    ))}
                </g>
                
                {/* 3D Eyes - No Stroke, Parallax Movement */}
                <g style={{ transform: `translate(${mousePos.x * 10}px, ${Math.sin(time)*3 + mousePos.y * 10}px)` }}>
                    {/* Left Eye */}
                    <circle cx="70" cy="80" r={isSpraying ? 22 : 18} fill="url(#eyeGrad)" />
                    <circle cx={70 + mousePos.x * 12} cy={80 + mousePos.y * 12} r="7" fill="black" />
                    <circle cx={70 + mousePos.x * 12 + 2} cy={80 + mousePos.y * 12 - 2} r="2" fill="white" />
                </g>
                <g style={{ transform: `translate(${mousePos.x * 10}px, ${Math.sin(time)*3 + mousePos.y * 10}px)` }}>
                    {/* Right Eye */}
                    <circle cx="130" cy="80" r={isSpraying ? 22 : 18} fill="url(#eyeGrad)" />
                    <circle cx={130 + mousePos.x * 12} cy={80 + mousePos.y * 12} r="7" fill="black" />
                    <circle cx={130 + mousePos.x * 12 + 2} cy={80 + mousePos.y * 12 - 2} r="2" fill="white" />
                </g>
                
                {/* Mouth - Organic Shape */}
                <g style={{ transform: `translate(${mousePos.x * 8}px, ${Math.sin(time * 0.8)*2 + mousePos.y * 8}px)` }}>
                    <path d={getMouthPath(mouthOpen)} fill={mouthOpen > 0.2 ? "#3f0a0a" : "#2a0a0a"} />
                </g>
             </svg>
             
             {/* 3D Evenly Distributed Ingredients */}
             {collectedIngredients.map((emoji, i) => {
                 if (!ingredientPositions[i]) return null;
                 const pos = ingredientPositions[i];
                 
                 // Apply rotation based on time + mouse
                 const rotY = (time * 0.5) + (mousePos.x * 0.8);
                 const rotX = (mousePos.y * 0.8);

                 // Standard 3D Rotation Matrices
                 let y = pos.y * Math.cos(rotX) - pos.z * Math.sin(rotX);
                 let z = pos.y * Math.sin(rotX) + pos.z * Math.cos(rotX);
                 let x = pos.x;

                 let x2 = x * Math.cos(rotY) - z * Math.sin(rotY);
                 let z2 = x * Math.sin(rotY) + z * Math.cos(rotY);
                 
                 const scale = (z2 + 250) / 250; 
                 const zIndex = Math.floor(z2);
                 const opacity = Math.max(0.2, Math.min(1, scale));

                 return (
                     <div key={i} 
                          className="absolute text-3xl pointer-events-none transition-transform will-change-transform"
                          style={{
                              left: `50%`, top: `50%`,
                              transform: `translate(${x2}px, ${y}px) scale(${scale}) translate(-50%, -50%)`, // Center the emoji
                              zIndex: zIndex + 10,
                              opacity: opacity,
                              filter: `blur(${Math.max(0, (1-scale)*5)}px)`
                          }}>
                         {emoji}
                     </div>
                 );
             })}
        </div>
      </div>

      {/* Sauce Controls - Increased padding to prevent overflow issues */}
      <div className="w-full max-w-4xl relative z-20 pb-4">
        <div className="absolute bottom-4 left-0 w-full h-12 bg-[#5d4037] rounded-sm shadow-2xl transform translate-y-4 border-t-4 border-[#8d6e63]"></div>
        <div className="flex justify-between items-end h-40 pb-6 px-4 md:px-12 overflow-visible gap-4 relative">
            {SAUCES.map((sauce) => (
                <button
                    key={sauce.id}
                    className={`relative group flex flex-col items-center justify-end w-20 md:w-24 h-full transition-all duration-200 shrink-0 ${selectedSauce === sauce.id ? '-translate-y-4' : 'hover:-translate-y-2'}`}
                    onMouseEnter={() => setSelectedSauce(sauce.id)}
                    onMouseDown={() => setIsSpraying(true)}
                    onMouseUp={() => setIsSpraying(false)}
                    onTouchStart={() => { setSelectedSauce(sauce.id); setIsSpraying(true); }}
                    onTouchEnd={() => setIsSpraying(false)}
                >
                    <div className="relative flex flex-col items-center transition-transform origin-bottom duration-100" style={{ transform: isSpraying && selectedSauce === sauce.id ? 'scaleY(0.9) scaleX(1.1)' : 'scale(1)' }}>
                         <div className="w-6 h-8 bg-white border-2 border-gray-300 rounded-t-md relative z-10 shadow-sm"><div className="w-1 h-3 bg-red-500 absolute -top-2 left-1/2 transform -translate-x-1/2 rounded-full"></div></div>
                         <div className="w-14 md:w-16 h-24 rounded-lg shadow-lg relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: sauce.color, border: `3px solid ${sauce.lightColor}` }}>
                             <div className="absolute top-2 left-2 w-2 h-16 bg-white/30 rounded-full blur-[1px]"></div>
                             <div className="bg-white/90 py-1 px-2 shadow-sm text-center transform -rotate-2 w-full mx-1">
                                <div className="text-[10px] text-black font-bold uppercase tracking-tighter">{sauce.label}</div>
                             </div>
                         </div>
                    </div>
                </button>
            ))}
        </div>
        <div className="w-full bg-gray-800 h-6 rounded-full mt-2 overflow-hidden border border-gray-600 relative mx-auto max-w-2xl shadow-inner mb-4">
            <div className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 transition-all duration-300" style={{ width: `${Math.min(100, feedProgress)}%` }} />
        </div>
      </div>
    </div>
  );
};