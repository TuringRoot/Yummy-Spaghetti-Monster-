
import React, { useState, useEffect, useRef } from 'react';
import { GameStage } from './types';
import { WebcamBackground } from './components/WebcamBackground';
import { StageIntro } from './components/StageIntro';
import { StageCooking } from './components/StageCooking';
import { StageFeeding } from './components/StageFeeding';
import { StageAftermath } from './components/StageAftermath';
import { StageExplosion } from './components/StageExplosion';
import { audio } from './utils/audio';

const App: React.FC = () => {
  const [stage, setStage] = useState<GameStage>(GameStage.INTRO);
  const [collectedIngredients, setCollectedIngredients] = useState<string[]>([]);
  const [finalColors, setFinalColors] = useState<string[]>(['#fbbf24']); // Default pasta color
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // Audio System Integration
  useEffect(() => {
      // Switch BGM whenever stage changes
      audio.playTheme(stage);
  }, [stage]);

  useEffect(() => {
    const initWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        setVideoStream(stream);
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };
    initWebcam();
  }, []);

  const handleStart = () => {
    // Resume audio context on first user interaction
    audio.init();
    audio.playSFX('click');
    setStage(GameStage.COOKING);
  };

  const handleCookingComplete = (ingredients: string[]) => {
    setCollectedIngredients(ingredients);
    // Short transition effect
    setStage(GameStage.TRANSITION_TO_FEEDING);
    setTimeout(() => setStage(GameStage.FEEDING), 2000);
  };

  const handleFeedingComplete = (colors: string[]) => {
      setFinalColors(colors);
      // Go to Explosion first
      setStage(GameStage.EXPLOSION);
  };

  const handleExplosionComplete = () => {
      audio.playSFX('explosion');
      setStage(GameStage.AFTERMATH);
  }

  const handleRestart = () => {
      audio.playSFX('click');
      setStage(GameStage.INTRO);
      setCollectedIngredients([]);
      setFinalColors(['#fbbf24']);
  };

  return (
    <div className="relative w-screen h-screen bg-neutral-900 overflow-hidden select-none">
      {/* Immersive Webcam Layer (Always renders behind) */}
      <WebcamBackground 
        stream={videoStream} 
        visible={stage !== GameStage.EXPLOSION} 
      />

      {/* Stage Manager */}
      <main className="relative z-10 w-full h-full">
        {stage === GameStage.INTRO && (
          <StageIntro onStart={handleStart} />
        )}

        {stage === GameStage.COOKING && (
          <StageCooking 
            onComplete={handleCookingComplete} 
            videoStream={videoStream}
          />
        )}

        {stage === GameStage.TRANSITION_TO_FEEDING && (
            <div className="w-full h-full flex items-center justify-center bg-black transition-opacity duration-1000">
                <h2 className="text-4xl text-yellow-500 handwritten animate-bounce">
                    The Pot boils over...
                </h2>
            </div>
        )}

        {stage === GameStage.FEEDING && (
          <StageFeeding 
            collectedIngredients={collectedIngredients} 
            onComplete={handleFeedingComplete}
            videoStream={videoStream}
          />
        )}
        
        {stage === GameStage.EXPLOSION && (
            <StageExplosion onComplete={handleExplosionComplete} />
        )}

        {stage === GameStage.AFTERMATH && (
          <StageAftermath 
            mixedColors={finalColors}
            ingredients={collectedIngredients}
            onRestart={handleRestart}
            videoStream={videoStream}
          />
        )}
      </main>

      {/* Global Vignette */}
      <div className={`absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] z-20 transition-opacity duration-500 ${stage === GameStage.EXPLOSION ? 'opacity-0' : 'opacity-100'}`} />
    </div>
  );
};

export default App;
