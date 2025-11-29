
import React, { useEffect, useState, useRef } from 'react';

interface StageExplosionProps {
  onComplete: () => void;
}

export const StageExplosion: React.FC<StageExplosionProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0); // 0 to 1
  const requestRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const duration = 140; 

    const animate = () => {
      frame++;
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
  // Start from scale 1.0 to match previous stage, then zoom in massively
  const scale = 1.0 + Math.pow(progress, 3) * 15.0; 
  
  // Shake
  const shakeIntensity = Math.pow(progress, 2) * 80; 
  const sx = (Math.random() - 0.5) * shakeIntensity;
  const sy = (Math.random() - 0.5) * shakeIntensity;

  // Distortion factors
  const mouthOpen = 0.2 + Math.pow(progress, 2) * 8.0; 
  const eyeBulge = 1 + progress * 1.5;
  const whiteout = progress > 0.85 ? (progress - 0.85) * 6.6 : 0;

  // Flying Pasta Debris
  const debris = [
      { angle: 45, dist: 280 + progress * 800, rot: progress * 720 },
      { angle: 135, dist: 300 + progress * 900, rot: -progress * 500 },
      { angle: 225, dist: 260 + progress * 850, rot: progress * 600 },
      { angle: 315, dist: 320 + progress * 950, rot: -progress * 800 },
      { angle: 0, dist: 350 + progress * 1000, rot: progress * 400 },
      { angle: 90, dist: 310 + progress * 900, rot: -progress * 300 },
      { angle: 180, dist: 360 + progress * 1100, rot: progress * 550 },
      { angle: 270, dist: 330 + progress * 950, rot: -progress * 450 },
  ];

  return (
    <div className="w-full h-full bg-[#1c1917] flex items-center justify-center overflow-hidden relative z-50">
      
      <svg 
        viewBox="0 0 1000 800" 
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full absolute transition-transform duration-75 will-change-transform"
        style={{
            transform: `translate(${sx}px, ${sy}px) scale(${scale}) rotate(${sx * 0.1}deg)`,
            transformOrigin: '50% 50%',
            filter: `blur(${whiteout * 30}px) contrast(${1 + progress * 0.5}) saturate(${1 + progress})`
        }}
      >
        <defs>
              {/* Emoji Skin Gradient */}
              <radialGradient id="gradEmojiSkin" cx="50%" cy="40%" r="50%">
                  <stop offset="0%" stopColor="#fde047" /> {/* Yellow-300 */}
                  <stop offset="70%" stopColor="#eab308" /> {/* Yellow-500 */}
                  <stop offset="100%" stopColor="#ca8a04" /> {/* Yellow-600 */}
              </radialGradient>

              {/* Deep Mouth Gradient */}
              <radialGradient id="gradMouthExplode" cx="50%" cy="50%" r="50%">
                  <stop offset="30%" stopColor="#450a0a" />
                  <stop offset="90%" stopColor="#7f1d1d" />
              </radialGradient>

              {/* Gloss Highlight */}
              <linearGradient id="gradGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>

              <pattern id="noodleTexture" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                   <path d="M 0 20 Q 10 0 20 20 T 40 20" stroke="#fcd34d" strokeWidth="3" fill="none" opacity="0.6" />
                   <path d="M 20 0 Q 30 20 40 0" stroke="#f59e0b" strokeWidth="3" fill="none" opacity="0.5" />
              </pattern>
        </defs>

        <g transform="translate(500, 400)">
             {/* Exploding Pasta Strands Background */}
             {debris.map((d, i) => (
                 <g key={i} transform={`rotate(${d.angle}) translate(${d.dist}, 0)`}>
                     <path 
                        d="M -60 0 Q 0 50 60 0" 
                        stroke="#fbbf24" 
                        strokeWidth={15 + progress * 15} 
                        fill="none" 
                        strokeLinecap="round"
                        transform={`rotate(${d.rot})`}
                     />
                 </g>
             ))}

             {/* Face Container */}
             <g>
                 {/* Emoji Base */}
                 <circle r={280} fill="url(#gradEmojiSkin)" />
                 
                 {/* Glossy Highlight at top */}
                 <ellipse cx="0" cy="-140" rx="160" ry="80" fill="url(#gradGloss)" opacity="0.6" />

                 {/* Subtle Noodle Texture overlay */}
                 <circle r={280} fill="url(#noodleTexture)" style={{mixBlendMode: 'overlay'}} opacity="0.3" />
                 
                 {/* Red Overlay for Rage/Heat */}
                 <circle r={280} fill="#ef4444" opacity={Math.min(1, progress * 1.5)} style={{mixBlendMode: 'color-burn'}} />

                 {/* Dynamic Mouth Shape - Ripping Open */}
                 <path 
                    d={`
                      M -180 ${-50 - mouthOpen * 20} 
                      Q 0 ${280 + mouthOpen * 300} 180 ${-50 - mouthOpen * 20} 
                      Q 120 ${-180 - mouthOpen * 100} 0 ${-140 - mouthOpen * 100} 
                      Q -120 ${-180 - mouthOpen * 100} -180 ${-50 - mouthOpen * 20}
                    `}
                    fill="url(#gradMouthExplode)" stroke="#450a0a" strokeWidth="10" 
                 />
                 
                 {/* Teeth - Jagged and flying apart */}
                 <g transform={`scale(${1 + progress * 0.5})`}>
                     <path d={`M -120 ${-40 - mouthOpen*20} L -90 ${30} L -60 ${-40 - mouthOpen*20}`} fill="#fff" />
                     <path d={`M 120 ${-40 - mouthOpen*20} L 90 ${30} L 60 ${-40 - mouthOpen*20}`} fill="#fff" />
                     <path d={`M -30 ${-60 - mouthOpen*30} L 0 ${60} L 30 ${-60 - mouthOpen*30}`} fill="#fff" />
                 </g>

                 {/* Eyes - Bulging Out */}
                 <g transform={`translate(0, ${-mouthOpen * 60 - 80})`}> 
                     
                     {/* Left Eye */}
                     <g transform={`translate(-140, -80) scale(${eyeBulge})`}>
                        <ellipse rx="70" ry="85" fill="white" stroke="#92400e" strokeWidth="4" />
                        <circle cx={(Math.random()-0.5)*20} cy={(Math.random()-0.5)*20} r={18} fill="#000" />
                        <circle cx={-5} cy={-5} r={5} fill="white" opacity="0.7" />
                        
                        {/* Bloodshot veins */}
                        <path d="M -35 35 L 0 0" stroke="#ef4444" strokeWidth="4" opacity={progress} />
                        <path d="M 35 35 L 0 0" stroke="#ef4444" strokeWidth="4" opacity={progress} />
                        
                        {/* Angry Brow - Raised high */}
                        <path 
                          d={`M -90 -110 Q 0 -60 100 -50`} 
                          stroke="#713f12" strokeWidth="20" strokeLinecap="round" fill="none"
                        />
                     </g>

                     {/* Right Eye */}
                     <g transform={`translate(140, -80) scale(${eyeBulge})`}>
                        <ellipse rx="70" ry="85" fill="white" stroke="#92400e" strokeWidth="4" />
                        <circle cx={(Math.random()-0.5)*20} cy={(Math.random()-0.5)*20} r={18} fill="#000" />
                        <circle cx={-5} cy={-5} r={5} fill="white" opacity="0.7" />
                        
                        {/* Bloodshot veins */}
                        <path d="M -35 35 L 0 0" stroke="#ef4444" strokeWidth="4" opacity={progress} />
                        <path d="M 35 35 L 0 0" stroke="#ef4444" strokeWidth="4" opacity={progress} />

                        {/* Angry Brow - Raised high */}
                        <path 
                          d={`M 90 -110 Q 0 -60 -100 -50`} 
                          stroke="#713f12" strokeWidth="20" strokeLinecap="round" fill="none"
                        />
                     </g>
                 </g>
             </g>
             
             {/* Intense Veins popping on face */}
             <g opacity={progress}>
                <path d="M -300 -250 Q -350 -300 -260 -350" stroke="#b91c1c" strokeWidth="12" fill="none" strokeLinecap="round" />
                <path d="M 300 -250 Q 350 -300 260 -350" stroke="#b91c1c" strokeWidth="12" fill="none" strokeLinecap="round" />
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
