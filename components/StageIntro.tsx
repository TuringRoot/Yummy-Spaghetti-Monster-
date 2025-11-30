
import React, { useEffect, useState } from 'react';
import { audio } from '../utils/audio';

interface StageIntroProps {
  onStart: () => void;
}

export const StageIntro: React.FC<StageIntroProps> = ({ onStart }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Try to init audio early if user clicked document before
    const handleInteraction = () => audio.init();
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        audio.init(); // Ensure audio context is ready
        onStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full text-center p-8 overflow-hidden">
      
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          {[...Array(12)].map((_, i) => (
              <div 
                key={i}
                className="absolute animate-float"
                style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${10 + Math.random() * 20}s`,
                    fontSize: `${20 + Math.random() * 40}px`,
                    opacity: 0.3 + Math.random() * 0.4
                }}
              >
                  {['🍝', '🍅', '🍄', '👨‍🍳', '🔥', '🧀'][i % 6]}
              </div>
          ))}
      </div>

      {/* Main Title Block */}
      <div className={`transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="mb-4 inline-block">
             <span className="text-6xl md:text-8xl handwritten text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse">
                Spaghetti
             </span>
             <br />
             <span className="text-6xl md:text-8xl handwritten text-white drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
                Monster
             </span>
        </div>
        
        <h2 className="text-xl md:text-2xl text-gray-300 mb-12 handwritten tracking-widest uppercase border-b border-gray-700 pb-4 inline-block px-8">
          The Digital Cooking Adventure
        </h2>
      </div>
      
      {/* Control Card */}
      <div className={`bg-neutral-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 max-w-2xl w-full shadow-2xl transform transition-all duration-1000 delay-300 ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="flex flex-col items-center group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <span className="text-3xl">👋</span>
            </div>
            <h3 className="font-bold text-blue-400 mb-1">Move Hand</h3>
            <p className="text-xs text-gray-400">Control the pot &<br/>aim the sauce</p>
          </div>
          
          <div className="flex flex-col items-center group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <span className="text-3xl">✊</span>
            </div>
            <h3 className="font-bold text-red-400 mb-1">Clench Fist</h3>
            <p className="text-xs text-gray-400">Catch ingredients &<br/>squeeze bottles</p>
          </div>
          
          <div className="flex flex-col items-center group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                <span className="text-3xl">🙂</span>
            </div>
            <h3 className="font-bold text-yellow-400 mb-1">Face Expression</h3>
            <p className="text-xs text-gray-400">Open mouth to<br/>make sounds</p>
          </div>
        </div>

        <button 
            onClick={() => { audio.init(); onStart(); }}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-yellow-500 font-mono rounded-lg hover:bg-yellow-400 focus:outline-none ring-offset-2 focus:ring-2 ring-yellow-400 w-full md:w-auto"
        >
            <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
            <span className="relative flex items-center gap-3 text-lg">
                START COOKING <span className="bg-black/20 px-2 py-0.5 rounded text-sm">SPACE</span>
            </span>
        </button>
      </div>

      <style>{`
        @keyframes float {
            0% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(10deg); }
            100% { transform: translateY(0) rotate(0deg); }
        }
        .animate-float {
            animation-name: float;
            animation-iteration-count: infinite;
            animation-timing-function: ease-in-out;
        }
      `}</style>
    </div>
  );
};
