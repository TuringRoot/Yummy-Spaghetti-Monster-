import React, { useEffect } from 'react';

interface StageIntroProps {
  onStart: () => void;
}

export const StageIntro: React.FC<StageIntroProps> = ({ onStart }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        onStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full text-center p-8">
      <h1 className="text-6xl md:text-8xl handwritten text-yellow-400 mb-8 animate-pulse drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">
        Spaghetti Monster
      </h1>
      <h2 className="text-2xl text-gray-300 mb-12 handwritten">
        The Digital Cooking Adventure
      </h2>
      
      <div className="bg-black/60 backdrop-blur-md p-6 rounded-xl border border-white/10 max-w-lg">
        <p className="text-xl mb-4 text-white">
          Press <span className="font-bold text-yellow-400 border px-2 py-1 rounded mx-1">SPACE</span> to Start
        </p>
        
        <div className="grid grid-cols-3 gap-4 mt-8 text-sm text-gray-400">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center mb-2">👋</div>
            <span>Move Mouse</span>
            <span className="text-xs opacity-50">Hand Movement</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2">✊</div>
            <span>Click & Hold</span>
            <span className="text-xs opacity-50">Grab / Catch</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center mb-2">🤏</div>
            <span>Scroll / Pinch</span>
            <span className="text-xs opacity-50">Control Flow</span>
          </div>
        </div>
      </div>
    </div>
  );
};