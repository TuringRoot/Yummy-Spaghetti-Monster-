import React, { useEffect, useState, useRef } from 'react';

interface StageExplosionProps {
  onComplete: () => void;
}

export const StageExplosion: React.FC<StageExplosionProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0); // 0 to 1
  const requestRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const duration = 140; // Extended slightly for dramatic buildup

    const animate = () => {
      frame++;
      // Non-linear progress for slow start, fast end
      const rawP = Math.min(frame / duration, 1);
      const p = Math.pow(rawP, 3); // Cubic ease in
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
  // Exponential scale for "pop" effect - Goes much bigger now to fill screen
  const scale = 0.5 + Math.pow(progress, 4) * 25.0; 
  
  // Shake intensity increases violently
  const shakeIntensity = Math.pow(progress, 2) * 120; // Massive shake at end
  const sx = (Math.random() - 0.5) * shakeIntensity;
  const sy = (Math.random() - 0.5) * shakeIntensity;

  // Mouth opening (0 = normal, 1 = huge scream)
  const mouthOpen = 0.2 + Math.pow(progress, 2) * 5.0; 
  
  // Whiteout starts at 80% progress
  const whiteout = progress > 0.8 ? (progress - 0.8) * 5 : 0;

  return (
    <div className="w-full h-full bg-[#1c1917] flex items-center justify-center overflow-hidden relative">
      
      <svg 
        viewBox="0 0 800 600" 
        className="w-full h-full absolute transition-transform duration-75 will-change-transform"
        style={{
            transform: `translate(${sx}px, ${sy}px) scale(${scale}) rotate(${sx * 0.1}deg)`,
            filter: `blur(${whiteout * 50}px) contrast(${1 + progress})`
        }}
      >
        <defs>
              <radialGradient id="gradMouthExplode" cx="50%" cy="50%" r="50%">
                  <stop offset="40%" stopColor="#450a0a" />
                  <stop offset="100%" stopColor="#ef4444" />
              </radialGradient>
              {/* Dynamic Clip Path for Teeth/Mouth */}
              <clipPath id="mouthClipExplode">
                 <ellipse cx="0" cy="20" rx={100 + mouthOpen * 30} ry={100 + mouthOpen * 120} />
              </clipPath>
        </defs>

        <g transform="translate(400, 300)">
             {/* Dynamic Mouth Shape - Screaming */}
             <path 
                d={`
                  M -120 ${-20 - mouthOpen * 10} 
                  Q 0 ${200 + mouthOpen * 250} 120 ${-20 - mouthOpen * 10} 
                  Q 80 ${-100 - mouthOpen * 80} 0 ${-100 - mouthOpen * 80} 
                  Q -80 ${-100 - mouthOpen * 80} -120 ${-20 - mouthOpen * 10}
                `}
                fill="url(#gradMouthExplode)" stroke="#3f0808" strokeWidth="6" 
             />
             
             {/* Teeth - Sharp and Angry */}
             <g clipPath="url(#mouthClipExplode)">
                 <g transform={`translate(0, ${-mouthOpen * 50})`}>
                    <path d="M -90 -20 L -65 60 L -40 -20" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
                    <path d="M 90 -20 L 65 60 L 40 -20" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
                    <path d="M -30 -30 L 0 50 L 30 -30" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
                    
                    <path d="M -60 180 L -35 110 L -10 180" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
                    <path d="M 60 180 L 35 110 L 10 180" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
                 </g>
             </g>

             {/* Eyes - Furious */}
             <g transform={`translate(0, ${-mouthOpen * 50 - 60})`}> 
                 
                 {/* Left Eye */}
                 <g transform="translate(-120, -90)">
                    <circle r={50 + progress * 20} fill="white" />
                    <circle cx={(Math.random()-0.5)*15} cy={(Math.random()-0.5)*15} r={8 - progress * 4} fill="#1e293b" />
                    {/* Veins in eye */}
                    <path d="M -20 20 L -10 10" stroke="#ef4444" strokeWidth="2" opacity={progress} />
                    <path d="M 20 20 L 10 10" stroke="#ef4444" strokeWidth="2" opacity={progress} />
                    
                    {/* Eyebrow - Deep Angry V Shape */}
                    <path 
                      d={`M -70 ${-20 - progress*40} L 60 ${40 + progress*20}`} 
                      stroke="#000" strokeWidth="18" strokeLinecap="round"
                    />
                 </g>

                 {/* Right Eye */}
                 <g transform="translate(120, -90)">
                    <circle r={50 + progress * 20} fill="white" />
                    <circle cx={(Math.random()-0.5)*15} cy={(Math.random()-0.5)*15} r={8 - progress * 4} fill="#1e293b" />
                    {/* Veins in eye */}
                    <path d="M -20 20 L -10 10" stroke="#ef4444" strokeWidth="2" opacity={progress} />
                    <path d="M 20 20 L 10 10" stroke="#ef4444" strokeWidth="2" opacity={progress} />

                    {/* Eyebrow */}
                    <path 
                      d={`M 70 ${-20 - progress*40} L -60 ${40 + progress*20}`} 
                      stroke="#000" strokeWidth="18" strokeLinecap="round"
                    />
                 </g>
             </g>
             
             {/* Intense Veins / Stress Marks */}
             <g opacity={progress}>
                <path d="M -220 -180 L -280 -220" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
                <path d="M -250 -140 L -300 -160" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
                <path d="M 220 -180 L 280 -220" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
                <path d="M 250 -140 L 300 -160" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
             </g>
        </g>
      </svg>

      {/* Whiteout Overlay */}
      <div 
        className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-75"
        style={{ opacity: whiteout }}
      />
    </div>
  );
};