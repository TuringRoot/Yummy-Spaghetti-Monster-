
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface StageAftermathProps {
    onRestart: () => void;
    mixedColors: string[];
    ingredients: string[];
}

interface Comment {
    id: number;
    user: string;
    text: string;
    avatar: string;
}

enum ParticleMode {
    CHAOS = 'CHAOS',
    BOWLS = 'BOWLS',
    HEART = 'HEART',
    GIO = 'GIO',
    SHATTER = 'SHATTER'
}

// Helper to create texture from emoji
const createEmojiTexture = (emoji: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(emoji, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

export const StageAftermath: React.FC<StageAftermathProps> = ({ onRestart, mixedColors, ingredients }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modeRef = useRef<ParticleMode>(ParticleMode.BOWLS);
  const particleTargetsRef = useRef<Float32Array | null>(null);
  const timeRef = useRef(0);
  const mousePosRef = useRef(new THREE.Vector3(0,0,0));
  
  const particlesRef = useRef<THREE.Group | null>(null);
  const eyesRef = useRef<{ mesh: THREE.Mesh, vel: THREE.Vector3, origin: THREE.Vector3 }[]>([]);
  const nervesRef = useRef<THREE.Mesh[]>([]);
  const slimeTrailsRef = useRef<THREE.Mesh[]>([]);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState(2500);
  const [activeMode, setActiveMode] = useState<ParticleMode>(ParticleMode.BOWLS);
  const [flashOpacity, setFlashOpacity] = useState(1);

  // --- Generators ---

  const generateBowlTargets = (count: number) => {
      const targets = new Float32Array(count * 3);
      const centers: THREE.Vector3[] = [];
      // 25 Bowl Centers spread out
      for(let i=0; i<25; i++) {
          centers.push(new THREE.Vector3(
              (Math.random()-0.5)*500, 
              (Math.random()-0.5)*300, 
              (Math.random()-0.5)*200
          ));
      }
      for(let i=0; i<count; i++) {
          const c = centers[i % 25];
          const theta = Math.random() * Math.PI * 2;
          const r = Math.random() * 20; 
          targets[i*3] = c.x + Math.cos(theta)*r;
          targets[i*3+1] = c.y + (Math.random()-0.5)*15; // Vertical piling
          targets[i*3+2] = c.z + Math.sin(theta)*r;
      }
      return targets;
  };

  const generateHeartTargets = (count: number) => {
      const targets = new Float32Array(count * 3);
      for(let i=0; i<count; i++) {
          const t = Math.random() * Math.PI * 2;
          // Parametric heart
          const x = 16 * Math.pow(Math.sin(t), 3);
          const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
          const scale = 12;
          targets[i*3] = x * scale + (Math.random()-0.5)*10;
          targets[i*3+1] = y * scale + 50 + (Math.random()-0.5)*10;
          targets[i*3+2] = (Math.random()-0.5) * 60;
      }
      return targets;
  };

  const generateGIOTargets = (count: number) => {
      const targets = new Float32Array(count * 3);
      const section = Math.floor(count / 3);
      
      const setP = (i: number, x: number, y: number) => {
          targets[i*3] = x + (Math.random()-0.5)*20; // More scatter for messy look
          targets[i*3+1] = y + (Math.random()-0.5)*20;
          targets[i*3+2] = (Math.random()-0.5)*40;
      };
      
      const radius = 80;
      const gCenterX = -250;
      for(let i=0; i<section; i++) {
          const progress = i / section;
          if (progress < 0.75) {
             const angle = (Math.PI * 0.25) + (progress / 0.75) * (Math.PI * 1.5); 
             const finalAngle = angle + Math.PI / 2;
             setP(i, gCenterX + Math.cos(finalAngle)*radius, Math.sin(finalAngle)*radius);
          } else {
             const barProgress = (progress - 0.75) / 0.25;
             setP(i, gCenterX + radius * 0.2 + barProgress * radius * 0.5, -radius * 0.1);
          }
      }

      for(let i=section; i<section*2; i++) {
          const h = ((i-section)/section) * 240 - 120;
          setP(i, 0, h);
      }

      for(let i=section*2; i<count; i++) {
          const t = ((i-section*2)/(count-section*2)) * Math.PI * 2;
          setP(i, 250 + Math.cos(t)*100, Math.sin(t)*100);
      }
      return targets;
  };

  const generateShatterTargets = (count: number) => {
      const targets = new Float32Array(count * 3);
      for(let i=0; i<count; i++) {
          targets[i*3] = (Math.random()-0.5) * 800;
          targets[i*3+1] = -250 + Math.random() * 20; // Pile on floor
          targets[i*3+2] = (Math.random()-0.5) * 400;
      }
      return targets;
  };

  // Switch Mode Logic
  const switchMode = (newMode: ParticleMode) => {
      modeRef.current = newMode;
      setActiveMode(newMode);
      // Total count needs to match particle creation count (ingredients + leftovers)
      const count = ingredients.length + 350; 
      
      if (newMode === ParticleMode.BOWLS) particleTargetsRef.current = generateBowlTargets(count);
      else if (newMode === ParticleMode.HEART) particleTargetsRef.current = generateHeartTargets(count);
      else if (newMode === ParticleMode.GIO) particleTargetsRef.current = generateGIOTargets(count);
      else if (newMode === ParticleMode.SHATTER) particleTargetsRef.current = generateShatterTargets(count);
      else particleTargetsRef.current = null;
  };

  useEffect(() => {
    const timer = setTimeout(() => setFlashOpacity(0), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); 
    scene.fog = new THREE.FogExp2(0x050505, 0.001);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.set(0, 50, 600);
    camera.lookAt(0, 0, 0); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    sceneRef.current = scene;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(200, 500, 200);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const backLight = new THREE.PointLight(0xffaa00, 1.0, 1000);
    backLight.position.set(-200, 100, -200);
    scene.add(backLight);

    // --- Particles Group ---
    const pGroup = new THREE.Group();
    scene.add(pGroup);
    particlesRef.current = pGroup;
    
    // 1. Ingredient Particles (Sprites)
    ingredients.forEach((ing) => {
        const tex = createEmojiTexture(ing);
        const mat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(mat);
        const size = 30 + Math.random() * 20;
        sprite.scale.set(size, size, 1);
        
        // Explosion Velocity
        sprite.userData = { 
            velocity: new THREE.Vector3(
                (Math.random()-0.5)*60, 
                (Math.random()-0.5)*60, 
                (Math.random()-0.5)*60
            ),
            rotVel: new THREE.Vector3(0,0,0), // Sprites don't rotate 3d
            isExploding: true 
        };
        pGroup.add(sprite);
    });

    // 2. Sticky Leftover Particles (Soft Blobs)
    // Use Dodecahedron for a lumpy sphere look
    const leftoverGeo = new THREE.DodecahedronGeometry(1, 0); 
    
    for(let i=0; i<350; i++) {
        const color = mixedColors[i % mixedColors.length];
        
        // Sticky/Wet Material
        const mat = new THREE.MeshPhysicalMaterial({ 
            color: color, 
            roughness: 0.4,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            flatShading: false
        });
        
        const mesh = new THREE.Mesh(leftoverGeo, mat);
        
        // Randomize size for "chunks"
        const scale = 3 + Math.random() * 8;
        mesh.scale.set(scale, scale, scale);
        
        mesh.position.set(0,0,0); 
        
        mesh.userData = { 
            velocity: new THREE.Vector3(
                (Math.random()-0.5)*60, 
                (Math.random()-0.5)*60, 
                (Math.random()-0.5)*60
            ),
            rotVel: new THREE.Vector3(Math.random()*0.1, Math.random()*0.1, Math.random()*0.1),
            isExploding: true
        };
        pGroup.add(mesh);
    }

    // --- Eyes ---
    const eyeGeo = new THREE.SphereGeometry(25, 32, 32);
    const whiteMat = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x555555, shininess: 100 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const createEye = (x: number) => {
        const e = new THREE.Mesh(eyeGeo, whiteMat);
        const p = new THREE.Mesh(new THREE.SphereGeometry(10), pupilMat);
        p.position.z = 21; 
        e.add(p);
        const s = new THREE.Mesh(new THREE.SphereGeometry(3), shineMat);
        s.position.set(5, 5, 24);
        e.add(s);
        e.position.set(x, 100, 50); 
        return e;
    };
    const lEye = createEye(-40); 
    const rEye = createEye(40);
    scene.add(lEye, rEye);
    
    eyesRef.current = [
        { mesh: lEye, vel: new THREE.Vector3(-25, 10, 30), origin: new THREE.Vector3(-40, 200, 0) },
        { mesh: rEye, vel: new THREE.Vector3(25, 15, -30), origin: new THREE.Vector3(40, 200, 0) }
    ];

    // Nerves
    const nerveMat = new THREE.MeshPhongMaterial({ color: 0xcc0000, shininess: 80 }); // Darker blood red
    const nerveA = new THREE.Mesh(new THREE.BufferGeometry(), nerveMat);
    const nerveB = new THREE.Mesh(new THREE.BufferGeometry(), nerveMat);
    scene.add(nerveA, nerveB);
    nervesRef.current = [nerveA, nerveB];

    // Initial Mode
    switchMode(ParticleMode.BOWLS);

    let frameId: number;
    const floorY = -250;
    const boundX = 500;
    let explosionFrame = 0;

    const animate = () => {
        frameId = requestAnimationFrame(animate);
        timeRef.current += 0.01;
        explosionFrame++;

        // Rotate group slightly
        if (particlesRef.current) {
            particlesRef.current.rotation.y = Math.sin(timeRef.current * 0.1) * 0.1;
        }
        
        // Calculate Mouse 3D Position for Interaction
        const vector = new THREE.Vector3(mousePosRef.current.x, mousePosRef.current.y, 0.5);
        if (cameraRef.current) vector.unproject(cameraRef.current);
        const dir = vector.sub(cameraRef.current!.position).normalize();
        const distance = -cameraRef.current!.position.z / dir.z;
        const mouse3D = cameraRef.current!.position.clone().add(dir.multiplyScalar(distance));

        const targets = particleTargetsRef.current;
        
        particlesRef.current?.children.forEach((obj, i) => {
            const vel = obj.userData.velocity;

            // 1. EXPLOSION PHASE
            if (explosionFrame < 80) {
                obj.position.add(vel);
                vel.multiplyScalar(0.94); // Drag
                if (obj instanceof THREE.Mesh) {
                    obj.rotation.x += obj.userData.rotVel.x;
                    obj.rotation.y += obj.userData.rotVel.y;
                }
            } else {
                // 2. MORPHING PHASE with MOUSE INTERACTION
                if (targets && i < targets.length / 3) {
                    let tx = targets[i*3];
                    let ty = targets[i*3+1];
                    let tz = targets[i*3+2];
                    
                    const targetPos = new THREE.Vector3(tx, ty, tz);

                    // --- Mouse Interaction ---
                    // Scatter/Flow/Jump when mouse is near
                    const distToMouse = obj.position.distanceTo(mouse3D);
                    const interactionRadius = 200;
                    
                    if (distToMouse < interactionRadius) {
                        // Repulsion Force
                        const force = (interactionRadius - distToMouse) / interactionRadius;
                        const repelDir = obj.position.clone().sub(mouse3D).normalize();
                        
                        // Push away from mouse
                        targetPos.add(repelDir.multiplyScalar(force * 150));
                        
                        // Add Vertical Jump/Flow (Sine wave based on index + time)
                        targetPos.y += Math.sin(timeRef.current * 15 + i * 0.1) * force * 60;
                        
                        // Add some random scatter
                        targetPos.x += (Math.random()-0.5) * force * 20;
                        targetPos.z += (Math.random()-0.5) * force * 20;
                    }

                    // Bowls Mode Specific global interaction
                    if (modeRef.current === ParticleMode.BOWLS) {
                        const expansion = 1 + (mousePosRef.current.x * 0.8); 
                        targetPos.x *= expansion;
                        targetPos.z *= expansion;
                    }

                    // Lerp to target
                    // Add noise drift constantly
                    targetPos.x += Math.sin(timeRef.current + i)*5;
                    targetPos.y += Math.cos(timeRef.current + i)*5;

                    obj.position.lerp(targetPos, 0.04);
                    
                    if (obj instanceof THREE.Mesh) {
                        obj.rotation.x += 0.01;
                        obj.rotation.y += 0.02;
                    }
                }
            }
        });

        // Eye Physics
        const mouse3DPlane = new THREE.Vector3(mousePosRef.current.x * 300, 0, 100);
        eyesRef.current.forEach((eye, idx) => {
            // Heavy Gravity
            eye.vel.y -= 1.5; 
            
            // Mouse Interaction when stationary/rolling on floor
            if (eye.mesh.position.y <= floorY + 30) {
                 const diffX = (mouse3DPlane.x - eye.mesh.position.x);
                 // Apply rolling force
                 eye.vel.x += diffX * 0.01; 
                 
                 // Blood Trail
                 if (Math.abs(eye.vel.x) > 2 && Math.random() > 0.85) {
                    const plane = new THREE.Mesh(
                        new THREE.CircleGeometry(15 + Math.random()*10, 8), 
                        new THREE.MeshBasicMaterial({ color: 0x880000, transparent: true, opacity: 0.6 })
                    );
                    plane.rotation.x = -Math.PI / 2;
                    plane.position.copy(eye.mesh.position);
                    plane.position.y = floorY + 2;
                    scene.add(plane);
                    slimeTrailsRef.current.push(plane);
                 }
            }

            // Integration
            eye.mesh.position.add(eye.vel);
            eye.mesh.lookAt(new THREE.Vector3(mouse3DPlane.x, mouse3DPlane.y + 100, 500));
            
            // Floor Bounce
            if (eye.mesh.position.y < floorY + 25) {
                eye.mesh.position.y = floorY + 25;
                // Bounce logic
                if (Math.abs(eye.vel.y) > 4) {
                    eye.vel.y *= -0.4; // Dampened bounce
                } else {
                    eye.vel.y = 0; // Stop bouncing
                }
                eye.vel.x *= 0.92; // Ground friction
                eye.vel.z *= 0.92;
            }

            // Nerve Constraint
            const nerveOrigin = eye.origin; 
            const dist = eye.mesh.position.distanceTo(nerveOrigin);
            if (dist > 480) { 
                const pull = eye.mesh.position.clone().sub(nerveOrigin).normalize().multiplyScalar((dist - 480) * -0.1);
                eye.vel.add(pull);
            }
            if (Math.abs(eye.mesh.position.x) > boundX) eye.vel.x *= -0.5;

            // Draw Nerve
            const midPoint = new THREE.Vector3().lerpVectors(nerveOrigin, eye.mesh.position, 0.5);
            midPoint.y -= 150; // Sag
            const curve = new THREE.CatmullRomCurve3([nerveOrigin, midPoint, eye.mesh.position]);
            
            if (nervesRef.current[idx]) {
                if (nervesRef.current[idx].geometry) nervesRef.current[idx].geometry.dispose();
                nervesRef.current[idx].geometry = new THREE.TubeGeometry(curve, 8, 4, 5, false);
            }
        });

        // Trail Cleanup
        if (slimeTrailsRef.current.length > 40) {
            const old = slimeTrailsRef.current.shift();
            if (old) { scene.remove(old); old.geometry.dispose(); (old.material as THREE.Material).dispose(); }
        }
        slimeTrailsRef.current.forEach(t => {
            (t.material as THREE.Material).opacity -= 0.005;
            t.scale.multiplyScalar(1.01); // Spread slightly
        });

        renderer.render(scene, camera);
    };
    animate();

    const handleMM = (e: MouseEvent) => {
        mousePosRef.current.set(
            (e.clientX / window.innerWidth) * 2 - 1, 
            -(e.clientY / window.innerHeight) * 2 + 1, 
            0
        );
    };
    window.addEventListener('mousemove', handleMM);
    
    return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('mousemove', handleMM);
        if (rendererRef.current) {
            rendererRef.current.dispose();
            const dom = rendererRef.current.domElement;
            if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
        }
    }
  }, [mixedColors, ingredients]);

  // UI
  useEffect(() => {
    const names = ["PastaLover99", "ChefMike", "FoodieX", "SpaghettiKing", "GioFan1", "U-Garden_Lover"];
    const msgs = ["Look at those eyes!", "Sticky!!", "More sauce!", "10/10", "GIO is the best!", "Wow!", "Yummy leftovers!", "Is that my broccoli?", "Digital Art!", "Tutorial when?"];
    const avs = ["🍕", "🍔", "🌭", "🥨", "🍟", "🥓"];
    
    const i = setInterval(() => {
        setComments(p => [{ 
            id: Date.now(), 
            user: names[Math.floor(Math.random()*names.length)], 
            text: msgs[Math.floor(Math.random()*msgs.length)], 
            avatar: avs[Math.floor(Math.random()*avs.length)] 
        }, ...p].slice(0, 6)); 
        setLikes(l => l + Math.floor(Math.random()*15));
    }, 1200);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="relative w-full h-full bg-black font-sans overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        
        <div 
            className="absolute inset-0 z-50 bg-white pointer-events-none transition-opacity duration-1000 ease-out"
            style={{ opacity: flashOpacity }}
        />
        
        <div className="absolute top-4 left-4 w-72 z-20 pointer-events-none">
            <div className="flex items-center gap-2 mb-3 bg-red-600 w-fit px-2 py-1 rounded text-white font-bold text-xs uppercase tracking-wider shadow-md">
                <span className="animate-pulse">●</span> LIVE
            </div>
            <div className="space-y-2">
                {comments.map(c => (
                    <div key={c.id} className="flex gap-3 bg-black/40 backdrop-blur-sm p-2 rounded-lg border border-white/5 animate-slide-in-left">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-sm shadow-inner shrink-0">
                            {c.avatar}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-gray-300 text-xs font-bold truncate">{c.user}</span>
                            <span className="text-white text-sm leading-tight shadow-black drop-shadow-sm">{c.text}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="absolute top-4 right-4 z-20 pointer-events-auto cursor-pointer flex flex-col items-center" onClick={() => setLikes(l=>l+1)}>
            <div className="text-4xl animate-bounce drop-shadow-md">❤️</div>
            <div className="text-pink-400 font-bold text-lg drop-shadow-md">{likes.toLocaleString()}</div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-30 pointer-events-auto">
            <button 
                onClick={() => switchMode(ParticleMode.BOWLS)} 
                className={`px-4 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 border-2 ${activeMode===ParticleMode.BOWLS ? 'bg-yellow-500 border-yellow-300 text-black' : 'bg-gray-800/80 border-gray-600 text-gray-300'}`}
            >
                🥣 Bowls
            </button>
            <button 
                onClick={() => switchMode(ParticleMode.HEART)} 
                className={`px-4 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 border-2 ${activeMode===ParticleMode.HEART ? 'bg-pink-600 border-pink-400 text-white' : 'bg-gray-800/80 border-gray-600 text-gray-300'}`}
            >
                ❤️ Heart
            </button>
            <button 
                onClick={() => switchMode(ParticleMode.GIO)} 
                className={`px-4 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 border-2 ${activeMode===ParticleMode.GIO ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800/80 border-gray-600 text-gray-300'}`}
            >
                🔤 GIO
            </button>
            <button 
                onClick={() => switchMode(ParticleMode.SHATTER)} 
                className={`px-4 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 border-2 ${activeMode===ParticleMode.SHATTER ? 'bg-red-800 border-red-600 text-white' : 'bg-gray-800/80 border-gray-600 text-gray-300'}`}
            >
                💥 Broken
            </button>
        </div>
    </div>
  );
};
