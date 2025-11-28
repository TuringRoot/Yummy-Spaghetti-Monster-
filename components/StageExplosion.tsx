import React, { useEffect, useState } from 'react';

interface StageExplosionProps {
  onComplete: () => void;
}

export const StageExplosion: React.FC<StageExplosionProps> = ({ onComplete }) => {
  const [scale, setScale] = useState(1);
  const [shake, setShake] = useState(0);
  const [whiteout, setWhiteout] = useState(0);

  useEffect(() => {
    // Animation sequence
    let frame = 0;
    const animate = () => {
      frame++;
      
      // Exponential scale: Start slow, end fast
      const newScale = 0.8 + Math.pow(frame, 3.2) * 0.00005; 
      setScale(newScale);

      // Increasing shake intensity
      setShake(Math.min(frame * 0.8, 60));

      // Whiteout at the end
      if (frame > 100) { 
         setWhiteout((frame - 100) / 40);
      }

      if (frame > 140) {
          onComplete();
      } else {
          requestAnimationFrame(animate);
      }
    };
    
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [onComplete]);

  // Shake offsets
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;

  return (
    <div className="w-full h-full bg-[#1c1917] flex items-center justify-center overflow-hidden relative">
      
      {/* SVG Container matching the aspect of StageFeeding */}
      <svg 
        viewBox="0 0 800 600" 
        className="w-full h-full absolute transition-transform duration-75 will-change-transform"
        style={{
            transform: `scale(${scale}) translate(${sx}px, ${sy}px)`,
            filter: `blur(${whiteout * 20}px)`
        }}
      >
        <defs>
              <radialGradient id="gradMouthExplode" cx="50%" cy="50%" r="50%">
                  <stop offset="60%" stopColor="#450a0a" />
                  <stop offset="100%" stopColor="#7f1d1d" />
              </radialGradient>
              <clipPath id="mouthClipExplode">
                 <ellipse cx="0" cy="20" rx="100" ry="140" />
              </clipPath>
        </defs>

        <g transform="translate(400, 300)">
             {/* Throat/Mouth Depth - Wide Open for explosion */}
             <ellipse 
                cx="0" cy="20" 
                rx="100" ry="140" 
                fill="url(#gradMouthExplode)" stroke="#3f0808" strokeWidth="4" 
             />
             
             {/* Teeth - Upper */}
             <g clipPath="url(#mouthClipExplode)">
                 <path 
                     d="M -60 -40 Q 0 -10 60 -40" 
                     fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2"
                 />
             </g>

             {/* Eyes - Wide Open in Shock */}
             {/* Left Eye */}
             <g transform="translate(-70, -80)">
                <circle r="40" fill="white" />
                {/* Dilated Pupil */}
                <circle cx="0" cy="0" r="12" fill="#1e293b" />
                <circle cx="-5" cy="-5" r="5" fill="white" opacity="0.8" />
                
                {/* Eyebrow - Angled up */}
                <path 
                  d="M -40 -50 Q 0 -70 40 -50" 
                  stroke="#000" strokeWidth="8" fill="none" strokeLinecap="round"
                  transform="rotate(-20)"
                />
             </g>

             {/* Right Eye */}
             <g transform="translate(70, -80)">
                <circle r="40" fill="white" />
                {/* Dilated Pupil */}
                <circle cx="0" cy="0" r="12" fill="#1e293b" />
                <circle cx="-5" cy="-5" r="5" fill="white" opacity="0.8" />

                {/* Eyebrow - Angled up */}
                <path 
                  d="M -40 -50 Q 0 -70 40 -50" 
                  stroke="#000" strokeWidth="8" fill="none" strokeLinecap="round"
                  transform="rotate(20)"
                />
             </g>
             
             {/* Sweat drops / Stress lines */}
             <path d="M -130 -100 L -150 -120" stroke="rgba(255,255,255,0.5)" strokeWidth="4" />
             <path d="M 130 -100 L 150 -120" stroke="rgba(255,255,255,0.5)" strokeWidth="4" />
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