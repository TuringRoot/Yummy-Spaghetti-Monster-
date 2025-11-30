import React, { useEffect, useRef, useState } from 'react';

interface VideoIntroProps {
  onComplete: () => void;
}

export const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSkipButton, setShowSkipButton] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Show skip button after 1 second
    const skipTimer = setTimeout(() => setShowSkipButton(true), 1000);

    const handleVideoEnd = () => {
      onComplete();
    };

    const handleCanPlay = () => {
      video.play().catch(err => console.error("Error playing video:", err));
    };

    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      clearTimeout(skipTimer);
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [onComplete]);

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black z-50 flex items-center justify-center">
      <video
        ref={videoRef}
        src="/intro.mp4"
        className="w-full h-full object-cover"
        playsInline
        autoPlay
      />
      
      {/* Skip Button */}
      {showSkipButton && (
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold backdrop-blur-sm transition-all duration-300 border border-white/30 z-10"
        >
          SKIP
        </button>
      )}
    </div>
  );
};
