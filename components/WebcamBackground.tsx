
import React, { useEffect, useRef } from 'react';

interface WebcamBackgroundProps {
  stream: MediaStream | null;
  visible?: boolean;
}

export const WebcamBackground: React.FC<WebcamBackgroundProps> = ({ stream, visible = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    // Moved up (top-16) and left (right-10)
    <div className={`fixed top-16 right-10 z-50 flex flex-col items-center pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      
      <div className="relative group">
        {/* Emoji Style Chef Hat - Shorter, Puffy, Lower down */}
        <div className="absolute -top-[25px] left-1/2 -translate-x-1/2 w-16 h-12 z-20 filter drop-shadow-lg transform -rotate-3">
            <svg viewBox="0 0 100 80" className="w-full h-full overflow-visible">
                {/* Puffy Cloud Shape for Hat Top - Cute Emoji Style */}
                <path 
                    d="M 10 55 Q 0 25 30 20 Q 50 0 70 20 Q 100 25 90 55 Z" 
                    fill="#ffffff" 
                />
                {/* Band */}
                <path 
                    d="M 12 55 L 88 55 L 86 72 Q 50 78 14 72 Z" 
                    fill="#f3f4f6" 
                />
                {/* Soft, minimal shading details */}
                <path d="M 32 55 Q 35 35 32 28" stroke="#e5e7eb" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
                <path d="M 68 55 Q 65 35 68 28" stroke="#e5e7eb" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
            </svg>
        </div>

        {/* Video Circle */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-[3px] border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.5)] bg-black relative z-10">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
          {/* Internal gloss reflection */}
          <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
        </div>

        {/* Luxurious Compact Nameplate - QQ Xuanwu Style */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-30 min-w-[100px] flex justify-center transform scale-90 origin-top">
            <div className="relative">
                {/* Golden Wing/Ornaments behind */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[120%] bg-gradient-to-r from-yellow-600/0 via-yellow-500/50 to-yellow-600/0 blur-sm"></div>

                {/* The Golden Bar */}
                <div className="relative px-3 py-1 bg-gradient-to-b from-[#FFF7CC] via-[#FFD700] to-[#B8860B] rounded-full border border-[#FFF8DC] shadow-[0_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden">
                    
                    {/* Moving Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-12 translate-x-[-150%] animate-shimmer"></div>

                    <div className="flex flex-col items-center relative z-10">
                         <span className="text-[7px] text-[#8B4513] font-bold tracking-[0.2em] uppercase leading-none mb-[1px]">
                            Level 99
                         </span>
                         <span className="text-[10px] font-black italic text-[#5c2e0a] uppercase tracking-widest leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]">
                            CHEF KING
                         </span>
                    </div>

                    {/* Side Gems */}
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full border border-white shadow-[0_0_4px_cyan]"></div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full border border-white shadow-[0_0_4px_cyan]"></div>
                </div>
            </div>
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
            0% { transform: translateX(-150%) skewX(-12deg); }
            100% { transform: translateX(150%) skewX(-12deg); }
        }
        .animate-shimmer {
            animation: shimmer 2s infinite linear;
        }
      `}</style>
    </div>
  );
};
