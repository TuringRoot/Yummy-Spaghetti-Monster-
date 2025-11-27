import React, { useState } from 'react';
import { GameStage } from './types';
import { WebcamBackground } from './components/WebcamBackground';
import { StageIntro } from './components/StageIntro';
import { StageCooking } from './components/StageCooking';
import { StageFeeding } from './components/StageFeeding';
import { StageAftermath } from './components/StageAftermath';

const App: React.FC = () => {
  const [stage, setStage] = useState<GameStage>(GameStage.INTRO);
  const [collectedIngredients, setCollectedIngredients] = useState<string[]>([]);
  const [finalColors, setFinalColors] = useState<string[]>(['#fbbf24']); // Default pasta color

  const handleStart = () => {
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
      // StageFeeding handles the visual "explosion/tearing" animation (approx 2s).
      // Once it triggers this callback, the screen is white (from StageFeeding's internal flash).
      // We move directly to AFTERMATH, skipping a separate "EXPLOSION" stage component
      // because the visual transition is now integrated into StageFeeding.
      setStage(GameStage.AFTERMATH);
  };

  const handleRestart = () => {
      setStage(GameStage.INTRO);
      setCollectedIngredients([]);
      setFinalColors(['#fbbf24']);
  };

  return (
    <div className="relative w-screen h-screen bg-neutral-900 overflow-hidden select-none">
      {/* Immersive Webcam Layer (Always renders behind) */}
      <WebcamBackground />

      {/* Stage Manager */}
      <main className="relative z-10 w-full h-full">
        {stage === GameStage.INTRO && (
          <StageIntro onStart={handleStart} />
        )}

        {stage === GameStage.COOKING && (
          <StageCooking onComplete={handleCookingComplete} />
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
          />
        )}
        
        {/* We removed the explicit EXPLOSION stage because StageFeeding now handles the visual flare */}

        {stage === GameStage.AFTERMATH && (
          <StageAftermath 
            mixedColors={finalColors}
            ingredients={collectedIngredients}
            onRestart={handleRestart} 
          />
        )}
      </main>

      {/* Global Vignette */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] z-20" />
    </div>
  );
};

export default App;