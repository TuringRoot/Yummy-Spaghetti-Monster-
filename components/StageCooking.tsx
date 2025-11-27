import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BAD_INGREDIENTS, GOOD_INGREDIENTS, Ingredient, IngredientType } from '../types';

interface StageCookingProps {
  onComplete: (collected: string[]) => void;
}

interface SteamParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

interface TextParticle {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    vy: number;
    scale: number;
}

interface CrowdMember {
  id: number;
  x: number;
  y: number; 
  vx: number; 
  skinColor: string;
  hairColor: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'bob' | 'buns' | 'pigtails';
  hatType: 'none' | 'cap' | 'beanie';
  shirtColor: string;
  pantsColor: string;
  hasGlasses: boolean;
  eyeColor: string;
  clothingPattern: 'plain' | 'striped' | 'logo' | 'plaid';
  walkOffset: number;
  isAngry: boolean;
  angryTimer: number;
}

interface AttachedBubble {
    id: number;
    targetStudentId: number;
    text: string;
    life: number;
    maxLife: number;
    isUrgent: boolean;
}

export const StageCooking: React.FC<StageCookingProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [score, setScore] = useState(0);
  
  const potActiveRef = useRef(false);
  const ingredientsRef = useRef<Ingredient[]>([]);
  const steamRef = useRef<SteamParticle[]>([]);
  const textParticlesRef = useRef<TextParticle[]>([]);
  const crowdRef = useRef<CrowdMember[]>([]);
  const bubblesRef = useRef<AttachedBubble[]>([]);
  const scoreRef = useRef(0);
  const frameIdRef = useRef<number>(0);
  const collectedRef = useRef<string[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const shakeRef = useRef(0);
  const spawnTimerRef = useRef(0); 
  const potFireTimerRef = useRef(0);

  // Initialize Crowd
  useEffect(() => {
    const crowd: CrowdMember[] = [];
    const skinTones = ['#fca5a5', '#fcd34d', '#d6d3d1', '#a97142', '#e5c298', '#ffdbac'];
    const hairColors = ['#0f172a', '#451a03', '#b45309', '#fef3c7', '#7f1d1d', '#ea580c', '#f472b6'];
    const shirtColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1', '#14b8a6', '#db2777'];
    const pantsColors = ['#1e3a8a', '#374151', '#78350f', '#000000', '#1f2937'];
    const eyeColors = ['#3b82f6', '#10b981', '#78350f', '#000000', '#8b5cf6'];
    const hairStyles = ['short', 'long', 'spiky', 'bob', 'buns', 'pigtails'] as const;
    const hatTypes = ['none', 'none', 'none', 'cap', 'beanie'] as const;
    const patterns = ['plain', 'striped', 'logo', 'plaid'] as const;

    const count = 10; 
    
    for (let i = 0; i < count; i++) {
        crowd.push({
            id: i,
            x: Math.random() * 90 + 5,
            y: Math.random(), 
            vx: (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.08),
            skinColor: skinTones[Math.floor(Math.random() * skinTones.length)],
            hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
            hairStyle: hairStyles[Math.floor(Math.random() * hairStyles.length)],
            hatType: hatTypes[Math.floor(Math.random() * hatTypes.length)],
            shirtColor: shirtColors[Math.floor(Math.random() * shirtColors.length)],
            pantsColor: pantsColors[Math.floor(Math.random() * pantsColors.length)],
            eyeColor: eyeColors[Math.floor(Math.random() * eyeColors.length)],
            hasGlasses: Math.random() > 0.7,
            clothingPattern: patterns[Math.floor(Math.random() * patterns.length)],
            walkOffset: Math.random() * Math.PI * 2,
            isAngry: false,
            angryTimer: 0,
        });
    }
    crowd.sort((a, b) => a.y - b.y);
    crowdRef.current = crowd;
  }, []);

  // Spawn Bubbles logic
  useEffect(() => {
    const normalMsgs = [
        "U-Garden smells amazing!", 
        "Love Gio Teacher!", 
        "PolyU Canteen rocks!", 
        "12:30 Tutorial T_T", 
        "Where is my pasta?", 
        "Is it ready yet?", 
        "Assignment due soon...",
        "So hungry!",
        "Senior Chef is cooking!"
    ];
    const angryMsgs = [
        "HURRY UP!", "TOO SLOW!", "I'M STARVING!", "FIRE THE CHEF!", "BAD SERVICE!", "😡😡😡"
    ];

    const interval = setInterval(() => {
      if (crowdRef.current.length === 0) return;
      const member = crowdRef.current[Math.floor(Math.random() * crowdRef.current.length)];
      
      const existingBubble = bubblesRef.current.find(b => b.targetStudentId === member.id);
      if (existingBubble) return;

      const isUrgent = member.isAngry || Math.random() > 0.9;
      const text = isUrgent 
        ? angryMsgs[Math.floor(Math.random() * angryMsgs.length)]
        : normalMsgs[Math.floor(Math.random() * normalMsgs.length)];

      bubblesRef.current.push({
          id: Date.now(),
          targetStudentId: member.id,
          text: text,
          life: 1.0,
          maxLife: 1.0,
          isUrgent: isUrgent
      });

    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const spawnIngredient = (width: number) => {
    const isGood = Math.random() > 0.4; 
    const pool = isGood ? GOOD_INGREDIENTS : BAD_INGREDIENTS;
    const item = pool[Math.floor(Math.random() * pool.length)];
    
    return {
      id: Date.now() + Math.random(),
      x: Math.random() * (width - 80) + 40,
      y: -60,
      vy: 4.0 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 1.0,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      emoji: item.emoji,
      name: item.name,
      type: isGood ? IngredientType.GOOD : IngredientType.BAD
    };
  };

  const spawnSteam = (x: number, y: number) => {
      for(let i=0; i<8; i++) {
          steamRef.current.push({
              id: Math.random(),
              x: x + (Math.random() - 0.5) * 40,
              y: y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 2,
              vy: -2 - Math.random() * 2,
              size: 15 + Math.random() * 20,
              alpha: 0.5 + Math.random() * 0.3
          });
      }
  };

  const spawnTextFeedback = (x: number, y: number, text: string, color: string) => {
      textParticlesRef.current.push({
          id: Math.random(),
          x: x,
          y: y - 50,
          text: text,
          color: color,
          life: 1.0,
          vy: -2,
          scale: 1.0
      });
  };

  const drawDynamicFire = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
      const t = timeRef.current * 0.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(0, -30 - Math.sin(t*3)*10, 10, 0);
      ctx.quadraticCurveTo(0, 10, -10, 0);
      ctx.fill();

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-15, 5);
      ctx.quadraticCurveTo(-5, -40 - Math.cos(t*2.5)*15, 0, -20);
      ctx.quadraticCurveTo(5, -45 - Math.sin(t*2)*15, 15, 5);
      ctx.quadraticCurveTo(0, 20, -15, 5);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-20, 10);
      ctx.quadraticCurveTo(-10, -30 - Math.sin(t*1.5)*10, -5, -15);
      ctx.quadraticCurveTo(0, -50 - Math.cos(t*3)*20, 5, -15);
      ctx.quadraticCurveTo(10, -35 - Math.sin(t*2)*10, 20, 10);
      ctx.quadraticCurveTo(0, 30, -20, 10);
      ctx.fill();

      ctx.restore();
  };

  const drawDetailedStudent = (ctx: CanvasRenderingContext2D, member: CrowdMember, x: number, y: number, size: number) => {
      ctx.save();
      ctx.translate(x, y);

      // --- 1. ALWAYS DRAW NORMAL BODY ---
      ctx.save();
      const bob = Math.sin(timeRef.current * 0.2 + member.walkOffset) * 3;
      ctx.translate(0, bob);
      const direction = member.vx < 0 ? -1 : 1;
      ctx.scale(direction, 1);

      // Shadow
      ctx.scale(1, 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(0, size*3.2, size*0.3, 0, Math.PI*2); ctx.fill();
      ctx.scale(1, 3.33);

      // Legs
      const legAngle = Math.sin(timeRef.current * 0.2 + member.walkOffset) * 0.8;
      ctx.strokeStyle = member.pantsColor;
      ctx.lineWidth = size * 0.18;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, size * 0.5); ctx.lineTo(Math.sin(legAngle) * size * 0.25, size * 0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, size * 0.5); ctx.lineTo(Math.sin(-legAngle) * size * 0.25, size * 0.95); ctx.stroke();

      // Body
      const bodyGrad = ctx.createRadialGradient(-size*0.1, size*0.2, 0, 0, size*0.3, size*0.5);
      bodyGrad.addColorStop(0, member.shirtColor);
      bodyGrad.addColorStop(1, 'black');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(-size*0.15, size*0.1); 
      ctx.lineTo(size*0.15, size*0.1);
      ctx.lineTo(size*0.22, size*0.55);
      ctx.quadraticCurveTo(0, size*0.6, -size*0.22, size*0.55);
      ctx.fill();

      // Shirt Details
      if (member.clothingPattern === 'striped') {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-size*0.1, size*0.2); ctx.lineTo(size*0.1, size*0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-size*0.12, size*0.35); ctx.lineTo(size*0.12, size*0.35); ctx.stroke();
      } else if (member.clothingPattern === 'logo') {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(0, size*0.3, size*0.06, 0, Math.PI*2); ctx.fill();
      }

      // Backpack
      ctx.fillStyle = '#4c1d95';
      ctx.beginPath(); ctx.roundRect(-size*0.42, size*0.12, size*0.2, size*0.4, 8); ctx.fill();
      ctx.fillStyle = '#6d28d9'; // Pocket
      ctx.beginPath(); ctx.roundRect(-size*0.4, size*0.35, size*0.16, size*0.15, 4); ctx.fill();
      
      // Arms
      ctx.strokeStyle = member.skinColor;
      ctx.lineWidth = size * 0.12;
      ctx.beginPath(); ctx.moveTo(-size*0.1, size*0.15); ctx.lineTo(-size*0.25, size*0.45); ctx.stroke();
      
      ctx.strokeStyle = member.shirtColor; 
      ctx.beginPath(); ctx.moveTo(size*0.1, size*0.15); ctx.lineTo(size*0.22, size*0.35); ctx.stroke();
      ctx.strokeStyle = member.skinColor;
      ctx.beginPath(); ctx.moveTo(size*0.22, size*0.35); ctx.lineTo(size*0.35, size*0.3); ctx.stroke();
      
      // Book
      ctx.fillStyle = '#2563eb';
      ctx.save();
      ctx.translate(size*0.35, size*0.3);
      ctx.rotate(-0.3);
      ctx.fillRect(-size*0.05, -size*0.15, size*0.25, size*0.3);
      // Book Pages
      ctx.fillStyle = '#fff';
      ctx.fillRect(-size*0.05 + 2, -size*0.15 + 2, size*0.25 - 4, size*0.3 - 4);
      ctx.restore();

      // Head
      ctx.fillStyle = member.skinColor;
      ctx.beginPath(); ctx.ellipse(0, -size*0.05, size*0.22, size*0.24, 0, 0, Math.PI*2); ctx.fill();

      // Hair Rendering Helper
      const drawHair = () => {
          ctx.fillStyle = member.hairColor;
          if (member.hatType === 'cap') {
              ctx.fillStyle = '#1f2937';
              ctx.beginPath(); ctx.arc(0, -size*0.15, size*0.24, Math.PI, 0); ctx.fill();
              ctx.fillRect(0, -size*0.15, size*0.35, size*0.05); // Brim
          } else if (member.hatType === 'beanie') {
              ctx.fillStyle = '#b91c1c';
              ctx.beginPath(); ctx.ellipse(0, -size*0.18, size*0.24, size*0.18, 0, Math.PI, 0); ctx.fill();
              ctx.fillRect(-size*0.24, -size*0.18, size*0.48, size*0.05);
          } else {
              // Dynamic Hair
              if (member.hairStyle === 'spiky') {
                 ctx.beginPath();
                 ctx.moveTo(-size*0.2, -size*0.1);
                 ctx.lineTo(-size*0.25, -size*0.35); ctx.lineTo(-size*0.1, -size*0.25);
                 ctx.lineTo(0, -size*0.38); ctx.lineTo(size*0.1, -size*0.25);
                 ctx.lineTo(size*0.25, -size*0.35); ctx.lineTo(size*0.2, -size*0.1);
                 ctx.fill();
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.22, Math.PI, 0); ctx.fill();
              } else if (member.hairStyle === 'long') {
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.24, Math.PI, 0); ctx.fill();
                 ctx.fillRect(-size*0.24, -size*0.1, size*0.48, size*0.25);
              } else if (member.hairStyle === 'buns') {
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.24, Math.PI, 0); ctx.fill();
                 ctx.beginPath(); ctx.arc(-size*0.25, -size*0.2, size*0.1, 0, Math.PI*2); ctx.fill();
                 ctx.beginPath(); ctx.arc(size*0.25, -size*0.2, size*0.1, 0, Math.PI*2); ctx.fill();
              } else if (member.hairStyle === 'pigtails') {
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.24, Math.PI, 0); ctx.fill();
                 ctx.fillRect(-size*0.28, -size*0.05, size*0.1, size*0.25);
                 ctx.fillRect(size*0.18, -size*0.05, size*0.1, size*0.25);
              } else { // short/bob
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.25, Math.PI, 0); ctx.fill();
              }
          }
      };
      
      drawHair();

      // Beautiful Eyes
      const eyeY = -size*0.05;
      const eyeSize = 4.5; // Bigger
      const eyeSpacing = 7;
      
      // Sclera
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.ellipse(-eyeSpacing, eyeY, eyeSize, eyeSize*1.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(eyeSpacing, eyeY, eyeSize, eyeSize*1.1, 0, 0, Math.PI*2); ctx.fill();
      
      // Iris
      ctx.fillStyle = member.eyeColor;
      ctx.beginPath(); ctx.arc(-eyeSpacing, eyeY, eyeSize*0.65, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(eyeSpacing, eyeY, eyeSize*0.65, 0, Math.PI*2); ctx.fill();
      
      // Pupil
      ctx.fillStyle = 'black';
      ctx.beginPath(); ctx.arc(-eyeSpacing, eyeY, eyeSize*0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(eyeSpacing, eyeY, eyeSize*0.3, 0, Math.PI*2); ctx.fill();
      
      // Highlights (Sparkle)
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(-eyeSpacing-1.5, eyeY-1.5, eyeSize*0.25, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(eyeSpacing-1.5, eyeY-1.5, eyeSize*0.25, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-eyeSpacing+1, eyeY+1, eyeSize*0.1, 0, Math.PI*2); ctx.fill(); 

      if (member.hasGlasses) {
          ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(-eyeSpacing, eyeY, eyeSize*1.6, 0, Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.arc(eyeSpacing, eyeY, eyeSize*1.6, 0, Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-eyeSpacing+eyeSize*1.6, eyeY); ctx.lineTo(eyeSpacing-eyeSize*1.6, eyeY); ctx.stroke();
          // Arms
          ctx.beginPath(); ctx.moveTo(-eyeSpacing-eyeSize*1.6, eyeY); ctx.lineTo(-size*0.2, eyeY-2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(eyeSpacing+eyeSize*1.6, eyeY); ctx.lineTo(size*0.2, eyeY-2); ctx.stroke();
      }

      ctx.restore(); // End Normal Body

      // --- 2. IF ANGRY, DRAW POPUP AVATAR ABOVE ---
      if (member.isAngry) {
          ctx.save();
          
          // Move bubble higher so it floats above head
          const bubbleY = -size * 1.1;

          drawDynamicFire(ctx, 0, bubbleY - size*0.2, 1.2);
          
          ctx.beginPath();
          ctx.arc(0, bubbleY, size*0.5, 0, Math.PI*2);
          ctx.fillStyle = '#fecaca'; 
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.save();
          ctx.clip(); 
          
          // Draw magnified head inside bubble
          // Center the head drawing inside the bubble
          ctx.translate(0, bubbleY + size*0.2);
          ctx.scale(1.5, 1.5);
          
          // Head
          ctx.fillStyle = member.skinColor;
          ctx.beginPath(); ctx.ellipse(0, -size*0.05, size*0.22, size*0.24, 0, 0, Math.PI*2); ctx.fill();
          
          // Angry Face
          ctx.strokeStyle = 'black'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-2, -4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(2, -4); ctx.stroke();
          ctx.fillStyle = 'white';
          ctx.beginPath(); ctx.arc(-5, -2, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(5, -2, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'black';
          ctx.beginPath(); ctx.arc(-5, -2, 1, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(5, -2, 1, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(0, 5, 4, Math.PI, 0); ctx.stroke();

          // Reuse Hair Logic for avatar
          // Need to set hat type for this scope or just reuse member properties
          if (member.hatType === 'cap') {
              ctx.fillStyle = '#1f2937';
              ctx.beginPath(); ctx.arc(0, -size*0.15, size*0.24, Math.PI, 0); ctx.fill();
              ctx.fillRect(0, -size*0.15, size*0.35, size*0.05); 
          } else if (member.hatType === 'beanie') {
              ctx.fillStyle = '#b91c1c';
              ctx.beginPath(); ctx.ellipse(0, -size*0.18, size*0.24, size*0.18, 0, Math.PI, 0); ctx.fill();
              ctx.fillRect(-size*0.24, -size*0.18, size*0.48, size*0.05);
          } else {
              ctx.fillStyle = member.hairColor;
              if (member.hairStyle === 'spiky') {
                 ctx.beginPath(); ctx.moveTo(-size*0.2, -size*0.1);
                 ctx.lineTo(-size*0.25, -size*0.35); ctx.lineTo(-size*0.1, -size*0.25);
                 ctx.lineTo(0, -size*0.38); ctx.lineTo(size*0.1, -size*0.25);
                 ctx.lineTo(size*0.25, -size*0.35); ctx.lineTo(size*0.2, -size*0.1);
                 ctx.fill();
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.22, Math.PI, 0); ctx.fill();
              } else if (member.hairStyle === 'long') {
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.24, Math.PI, 0); ctx.fill();
                 ctx.fillRect(-size*0.24, -size*0.1, size*0.48, size*0.25);
              } else if (member.hairStyle === 'buns') {
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.24, Math.PI, 0); ctx.fill();
                 ctx.beginPath(); ctx.arc(-size*0.25, -size*0.2, size*0.1, 0, Math.PI*2); ctx.fill();
                 ctx.beginPath(); ctx.arc(size*0.25, -size*0.2, size*0.1, 0, Math.PI*2); ctx.fill();
              } else if (member.hairStyle === 'pigtails') {
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.24, Math.PI, 0); ctx.fill();
                 ctx.fillRect(-size*0.28, -size*0.05, size*0.1, size*0.25);
                 ctx.fillRect(size*0.18, -size*0.05, size*0.1, size*0.25);
              } else { 
                 ctx.beginPath(); ctx.arc(0, -size*0.1, size*0.25, Math.PI, 0); ctx.fill();
              }
          }
          
          ctx.restore(); // End Clip
          ctx.restore(); // End Avatar transform
      }

      ctx.restore(); // End Main
  };

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    timeRef.current++;

    // Shake
    if (shakeRef.current > 0) {
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
    }
    const shakeX = (Math.random() - 0.5) * shakeRef.current;
    const shakeY = (Math.random() - 0.5) * shakeRef.current;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(0, 0, width, height);

    const cookingAreaHeight = height - 150; // Space for students
    
    // 1. Dark Kitchen Background
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, width);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Tiles
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 2;
    for(let i=0; i<width; i+=50) {
        for(let j=0; j<cookingAreaHeight; j+=50) {
            ctx.strokeRect(i, j, 50, 50);
        }
    }

    // Floor Line
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, cookingAreaHeight, width, 150);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, cookingAreaHeight, width, 20); // Shadow line

    // 2. Crowd - SHIFT UP: Use (cookingAreaHeight + 20) as base instead of +60
    crowdRef.current.sort((a, b) => a.y - b.y);
    crowdRef.current.forEach((member) => {
        member.x += member.vx;
        if (member.x > 95 || member.x < 5) member.vx *= -1;

        if (shakeRef.current > 5 && !member.isAngry && Math.random() < 0.05) {
            member.isAngry = true;
            member.angryTimer = 100;
        }
        if (member.isAngry) {
            member.angryTimer--;
            if (member.angryTimer <= 0) member.isAngry = false;
        }

        const cx = (member.x / 100) * width;
        // Shift Y up so they aren't cut off. Range 0-1 mapped to 40px depth. 
        // Base y = cookingAreaHeight + 20 puts feet on floor.
        const cy = cookingAreaHeight + 20 + (member.y * 40); 
        drawDetailedStudent(ctx, member, cx, cy, 80);
    });

    // Bubbles
    for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
        const bubble = bubblesRef.current[i];
        bubble.life -= 0.005; 
        if (bubble.life <= 0) {
            bubblesRef.current.splice(i, 1);
            continue;
        }

        const target = crowdRef.current.find(m => m.id === bubble.targetStudentId);
        if (target) {
            const bx = (target.x / 100) * width;
            // Adjust bubble anchor to match new student height
            let by = cookingAreaHeight + 20 + (target.y * 40) - 95;
            if (target.isAngry) by -= 70; // Move bubble higher if angry popup exists

            ctx.save();
            ctx.globalAlpha = Math.min(1, bubble.life * 2);
            ctx.translate(bx, by);
            ctx.translate(0, Math.sin(timeRef.current * 0.1) * 3);

            ctx.font = bubble.isUrgent ? "bold 20px 'Gochi Hand'" : "18px 'Gochi Hand'";
            const metrics = ctx.measureText(bubble.text);
            const w = metrics.width + 20;
            const h = 34;

            ctx.fillStyle = bubble.isUrgent ? 'rgba(254, 202, 202, 0.9)' : 'rgba(255, 255, 255, 0.85)';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.roundRect(-w/2, -h, w, h, 10); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, 8); ctx.lineTo(5, 0); ctx.fill(); ctx.stroke();

            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(bubble.text, 0, -8);
            ctx.restore();
        }
    }

    // 3. Pot
    const potWidth = 180;
    const potHeight = 110;
    const potY = cookingAreaHeight - 120;
    let potX = mouseRef.current.x - potWidth / 2;
    potX = Math.max(0, Math.min(width - potWidth, potX));
    const isActive = potActiveRef.current;

    // Fire FX
    if (potFireTimerRef.current > 0) {
        potFireTimerRef.current--;
        drawDynamicFire(ctx, potX + potWidth/2, potY + 50, 1.8);
    }

    // Pot Handle
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(potX, potY + 20);
    ctx.bezierCurveTo(potX - 40, potY + 10, potX - 40, potY - 20, potX + 20, potY);
    ctx.stroke();

    // Pot Body
    const gradPot = ctx.createLinearGradient(potX, potY, potX + potWidth, potY + potHeight);
    gradPot.addColorStop(0, '#374151');
    gradPot.addColorStop(1, '#111827');
    ctx.fillStyle = gradPot;
    ctx.beginPath();
    ctx.moveTo(potX, potY + 15);
    ctx.bezierCurveTo(potX, potY + potHeight + 20, potX + potWidth, potY + potHeight + 20, potX + potWidth, potY + 15);
    ctx.fill();
    
    // Rim
    ctx.fillStyle = '#4b5563';
    ctx.beginPath(); ctx.ellipse(potX + potWidth/2, potY + 15, potWidth/2, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 4. Ingredients
    spawnTimerRef.current++;
    if (spawnTimerRef.current > 25) { // Uniform
        ingredientsRef.current.push(spawnIngredient(width));
        spawnTimerRef.current = 0;
    }

    for (let i = ingredientsRef.current.length - 1; i >= 0; i--) {
        const ing = ingredientsRef.current[i];
        ing.y += ing.vy;
        ing.x += ing.vx;
        ing.rotation += ing.rotationSpeed;

        if (ing.x < 20 || ing.x > width - 20) ing.vx *= -1;

        ctx.save();
        ctx.translate(ing.x, ing.y);
        ctx.rotate(ing.rotation);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = ing.type === IngredientType.GOOD ? '#fbbf24' : '#ef4444'; 
        
        ctx.font = "46px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ing.emoji, 0, 0);
        ctx.restore();

        const catchY = potY + 15;
        if (isActive && 
            ing.y > potY - 20 && ing.y < catchY + 40 &&
            ing.x > potX + 10 && ing.x < potX + potWidth - 10) {
            
            ingredientsRef.current.splice(i, 1);

            if (ing.type === IngredientType.GOOD) {
                scoreRef.current += 1;
                setScore(scoreRef.current);
                collectedRef.current.push(ing.emoji);
                spawnSteam(ing.x, potY);
                spawnTextFeedback(ing.x, potY, "Yummy!", "#fcd34d");
                if (scoreRef.current >= 10) onComplete(collectedRef.current);
            } else {
                spawnTextFeedback(ing.x, potY, "YUCK!", "#ef4444");
                shakeRef.current = 25;
                potFireTimerRef.current = 40;
            }
            continue;
        }

        if (ing.y > cookingAreaHeight + 20) ingredientsRef.current.splice(i, 1);
    }
    
    // Particles & Text
    for (let i = steamRef.current.length - 1; i >= 0; i--) {
        const p = steamRef.current[i];
        p.y += p.vy; p.x += p.vx; p.size += 0.3; p.alpha -= 0.02;
        if (p.alpha <= 0) steamRef.current.splice(i, 1);
        else {
            ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        }
    }
    for (let i = textParticlesRef.current.length - 1; i >= 0; i--) {
        const p = textParticlesRef.current[i];
        p.y += p.vy; p.life -= 0.02;
        if (p.life <= 0) textParticlesRef.current.splice(i, 1);
        else {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.font = "bold 36px 'Gochi Hand'";
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
    }

    // Cursor
    const cursorX = mouseRef.current.x;
    const cursorY = mouseRef.current.y;
    ctx.save();
    ctx.translate(cursorX, cursorY);
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isActive ? '✊' : '✋', 0, 0);
    ctx.font = "30px Arial";
    ctx.fillText('👨‍🍳', 5, -35 + Math.sin(timeRef.current * 0.2) * 2);
    ctx.restore();

    ctx.restore(); // End shake
    frameIdRef.current = requestAnimationFrame(gameLoop);
  }, [onComplete]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else {
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
    }
    mouseRef.current.x = clientX - rect.left;
    mouseRef.current.y = clientY - rect.top;
  };
  
  const handleDown = () => { potActiveRef.current = true; };
  const handleUp = () => { potActiveRef.current = false; };

  useEffect(() => {
    frameIdRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [gameLoop]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full cursor-none touch-none bg-[#0f172a]" 
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-50">
         <div className="bg-red-600/90 text-white font-bold px-8 py-1 rounded-b-xl shadow-lg border-x border-b border-red-400 animate-pulse tracking-widest text-lg">
             ✊ CLENCH FIST TO CATCH FOOD
         </div>
      </div>

      <div className="absolute top-6 left-4 flex items-center gap-4">
          <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 shadow-lg flex items-center gap-3 transform -rotate-1">
            <span className="text-4xl filter drop-shadow-md">🥘</span>
            <div>
                <div className="text-white font-bold text-2xl handwritten tracking-wide drop-shadow-md">
                   Ingredients
                </div>
                <div className="flex gap-1 mt-1">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full border border-black/30 shadow-inner ${i < score ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                    ))}
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};