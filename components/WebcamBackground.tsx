import React, { useEffect, useRef } from 'react';

export const WebcamBackground: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };

    startVideo();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-center pointer-events-none">
      <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)] bg-black relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />
        <div className="absolute inset-0 ring-2 ring-inset ring-white/20 rounded-full" />
      </div>
      <div className="mt-1 px-3 py-1 bg-black/80 backdrop-blur border border-yellow-500/30 rounded-full text-yellow-400 font-bold text-xs tracking-wider shadow-lg handwritten">
        Senior Chef
      </div>
    </div>
  );
};