import React, { useEffect, useState, useRef } from 'react';

interface StageExplosionProps {
  onComplete: () => void;
}

export const StageExplosion: React.FC<StageExplosionProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0); // 0 to 1
  const requestRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const duration = 140; // Total frames

    const animate = () => {
      frame++;
      const p = Math.min(frame / duration, 1);
      setProgress(p);

      if (frame > duration) {
          onComplete();
      } else {
          requestRef.current = requestAnimationFrame(animate);
      }
    };
    
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [onComplete]);

  // Derived Animation Values
  // Exponential scale for "pop" effect
  const scale = 0.8 + Math.pow(progress, 4) * 5.0; 
  
  // Shake intensity increases with progress
  const shakeIntensity = Math.pow(progress, 2) * 50;
  const sx = (Math.random() - 0.5) * shakeIntensity;
  const sy = (Math.random() - 0.5) * shakeIntensity;

  // Mouth opening (0 = normal, 1 = huge)
  const mouthOpen = 0.2 + Math.pow(progress, 2) * 2.5; 
  
  // Whiteout starts at 80% progress
  const whiteout = progress > 0.8 ? (progress - 0.8) * 5 : 0;

  return (
    <div className="w-full h-full bg-[#1c1917] flex items-center justify-center overflow-hidden relative">
      
      <svg 
        viewBox="0 0 800 600" 
        className="w-full h-full absolute transition-transform duration-75 will-change-transform"
        style={{
            transform: `translate(${sx}px, ${sy}px) scale(${scale})`,
            filter: `blur(${whiteout * 10}px)`
        }}
      >
        <defs>
              <radialGradient id="gradMouthExplode" cx="50%" cy="50%" r="50%">
                  <stop offset="60%" stopColor="#450a0a" />
                  <stop offset="100%" stopColor="#7f1d1d" />
              </radialGradient>
              {/* Dynamic Clip Path for Teeth/Mouth */}
              <clipPath id="mouthClipExplode">
                 <ellipse cx="0" cy="20" rx={100 + mouthOpen * 20} ry={100 + mouthOpen * 100} />
              </clipPath>
        </defs>

        <g transform="translate(400, 300)">
             {/* Dynamic Mouth Shape */}
             <path 
                d={`
                  M -90 ${-20 - mouthOpen * 10} 
                  Q 0 ${160 + mouthOpen * 200} 90 ${-20 - mouthOpen * 10} 
                  Q 60 ${-60 - mouthOpen * 50} 0 ${-60 - mouthOpen * 50} 
                  Q -60 ${-60 - mouthOpen * 50} -90 ${-20 - mouthOpen * 10}
                `}
                fill="url(#gradMouthExplode)" stroke="#3f0808" strokeWidth="4" 
             />
             
             {/* Teeth - Moving apart as mouth opens */}
             <g clipPath="url(#mouthClipExplode)">
                 <g transform={`translate(0, ${-mouthOpen * 40})`}>
                    <path d="M -70 -20 L -50 40 L -30 -20" fill="#f3f4f6" stroke="#d1d5db" />
                    <path d="M 70 -20 L 50 40 L 30 -20" fill="#f3f4f6" stroke="#d1d5db" />
                    <path d="M -20 -30 L 0 30 L 20 -30" fill="#f3f4f6" stroke="#d1d5db" />
                 </g>
             </g>

             {/* Eyes - Expanding and Shaking */}
             <g transform={`translate(0, ${-mouthOpen * 30})`}> {/* Eyes move up slightly as mouth opens */}
                 
                 {/* Left Eye */}
                 <g transform="translate(-90, -100)">
                    <circle r={40 + progress * 10} fill="white" />
                    {/* Iris shrinks in shock */}
                    <circle cx={(Math.random()-0.5)*5} cy={(Math.random()-0.5)*5} r={14 - progress * 8} fill="#1e293b" />
                    
                    {/* Eyebrow - Angry to Shocked transition */}
                    <path 
                      d={`M -50 ${-40 - progress*40} L 40 ${10 - progress*50}`} 
                      stroke="#000" strokeWidth="12" strokeLinecap="round"
                    />
                 </g>

                 {/* Right Eye */}
                 <g transform="translate(90, -100)">
                    <circle r={40 + progress * 10} fill="white" />
                    {/* Iris */}
                    <circle cx={(Math.random()-0.5)*5} cy={(Math.random()-0.5)*5} r={14 - progress * 8} fill="#1e293b" />

                    {/* Eyebrow */}
                    <path 
                      d={`M 50 ${-40 - progress*40} L -40 ${10 - progress*50}`} 
                      stroke="#000" strokeWidth="12" strokeLinecap="round"
                    />
                 </g>
             </g>
             
             {/* Stress Marks - Fading in */}
             <g opacity={progress}>
                <path d="M -180 -120 L -220 -160" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
                <path d="M -200 -100 L -240 -120" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
                
                <path d="M 180 -120 L 220 -160" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
                <path d="M 200 -100 L 240 -120" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
             </g>
        </g>
      </svg>

      {/* Whiteout Overlay */}
      <div 
        className="absolute inset-0 bg-white pointer-events-none"
        style={{ opacity: whiteout }}
      />
    </div>
  );
};