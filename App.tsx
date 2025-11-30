import React, { useState, useEffect, useCallback } from 'react';
import { GameStage } from './types';
import { WebcamBackground } from './components/WebcamBackground';
import { VideoIntro } from './components/VideoIntro';
import { StageIntro } from './components/StageIntro';
import { StageCooking } from './components/StageCooking';
import { StageFeeding } from './components/StageFeeding';
import { StageAftermath } from './components/StageAftermath';
import { StageStatue } from './components/StageStatue';
import { audio } from './utils/audio';

// Suppress specific MediaPipe/TFLite info logs that might be mistaken for errors
const originalInfo = console.info;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const shouldSuppress = (args: any[]) => {
    if (args.length === 0) return false;
    // Join all arguments to check the full message string
    const msg = args.map(arg => String(arg)).join(' ');
    return (
        msg.includes('Created TensorFlow Lite XNNPACK delegate for CPU') ||
        msg.includes('XNNPACK') ||
        msg.includes('INFO: Created TensorFlow')
    );
};

console.info = (...args) => {
    if (shouldSuppress(args)) return;
    originalInfo.apply(console, args);
};

console.log = (...args) => {
    if (shouldSuppress(args)) return;
    originalLog.apply(console, args);
};

console.warn = (...args) => {
    if (shouldSuppress(args)) return;
    originalWarn.apply(console, args);
};

console.error = (...args) => {
    if (shouldSuppress(args)) return;
    originalError.apply(console, args);
};

const App: React.FC = () => {
  const [stage, setStage] = useState<GameStage>(GameStage.VIDEO_INTRO);
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

  const handleStart = useCallback(() => {
    // Resume audio context on first user interaction
    audio.init();
    audio.playSFX('click');
    setStage(GameStage.COOKING);
  }, []);

  const handleCookingComplete = useCallback((ingredients: string[]) => {
    setCollectedIngredients(ingredients);
    // Short transition effect
    setStage(GameStage.TRANSITION_TO_FEEDING);
    setTimeout(() => setStage(GameStage.FEEDING), 2000);
  }, []);

  const handleFeedingComplete = useCallback((colors: string[]) => {
      setFinalColors(colors);
      // Skip Explosion, go directly to Aftermath
      setStage(GameStage.AFTERMATH);
  }, []);

  const handleRestart = useCallback(() => {
      audio.playSFX('click');
      setStage(GameStage.VIDEO_INTRO);
      setCollectedIngredients([]);
      setFinalColors(['#fbbf24']);
  }, []);

  const handleStatueTransition = useCallback(() => {
      setStage(GameStage.STATUE);
  }, []);

  const handleBackToAftermath = useCallback(() => {
      audio.playSFX('click');
      setStage(GameStage.AFTERMATH);
  }, []);

  const handleVideoIntroComplete = useCallback(() => {
      setStage(GameStage.INTRO);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-neutral-900 overflow-hidden select-none">
      {/* Immersive Webcam Layer (Always renders behind) */}
      <WebcamBackground 
        stream={videoStream} 
        visible={true} 
      />

      {/* Stage Manager */}
      <main className="relative z-10 w-full h-full">
        {stage === GameStage.VIDEO_INTRO && (
          <VideoIntro onComplete={handleVideoIntroComplete} />
        )}

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

        {stage === GameStage.AFTERMATH && (
          <StageAftermath 
            mixedColors={finalColors}
            ingredients={collectedIngredients}
            onRestart={handleRestart}
            onNextStage={handleStatueTransition}
            videoStream={videoStream}
          />
        )}

        {stage === GameStage.STATUE && (
            <StageStatue 
                onBack={handleBackToAftermath}
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