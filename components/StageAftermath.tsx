
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { audio } from '../utils/audio';

interface StageAftermathProps {
    onRestart: () => void;
    mixedColors: string[];
    ingredients: string[];
    videoStream: MediaStream | null;
}

interface Comment {
    id: number;
    user: string;
    text: string;
    avatar: string;
    color: string;
    isGift?: boolean;
    isVip?: boolean;
}

interface Heart {
    id: number;
    x: number; // Offset from right
    y: number; // Vertical position (0 is bottom)
    size: number;
    type: string;
    color: string;
    speed: number;
    wobbleOffset: number;
    rotation: number;
}

interface LuxuryGift {
    id: number;
    emoji: string;
    label: string;
    color: string;
}

// --- CONSTANTS & TYPES ---
const MODES = ['CHAOS', 'DROP', 'DINING', 'HEART', 'GIO'] as const;
type VisualMode = typeof MODES[number];

const PARTICLE_COUNT = 1500; 
const INGREDIENT_DENSITY = 40; 
const BOWL_COUNT = 30;

const LUXURY_ITEMS = [
    { emoji: '🏎️', label: 'Lambo', color: '#ef4444' },
    { emoji: '🚀', label: 'Rocket', color: '#3b82f6' },
    { emoji: '💎', label: 'Diamond', color: '#06b6d4' },
    { emoji: '🏰', label: 'Mansion', color: '#a855f7' },
    { emoji: '🛥️', label: 'Yacht', color: '#10b981' },
];

const AVATARS = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆", "🦄", "🐴", "🐗", "🐺", "🦇", "🦉", "🦅", "🐝", "🐛", "🦋"];

const LIKE_ICONS = ["❤️", "💖", "🔥", "🌟", "👍", "🍝", "🥰", "🧡"];

// --- Helper Functions ---
const generateShapes = (width: number, height: number) => {
    const targets: Record<VisualMode, Float32Array> = {
        CHAOS: new Float32Array(PARTICLE_COUNT * 3),
        DROP: new Float32Array(PARTICLE_COUNT * 3),
        DINING: new Float32Array(PARTICLE_COUNT * 3),
        HEART: new Float32Array(PARTICLE_COUNT * 3),
        GIO: new Float32Array(PARTICLE_COUNT * 3),
    };

    const randomSphere = (radius: number) => {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random()) * radius;
        return {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi)
        };
    };

    // A. CHAOS
    for(let i=0; i<PARTICLE_COUNT; i++) {
        const p = randomSphere(600);
        targets.CHAOS[i*3] = p.x;
        targets.CHAOS[i*3+1] = p.y;
        targets.CHAOS[i*3+2] = p.z;
    }

    // B. DROP
    for(let i=0; i<PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 600;
        targets.DROP[i*3] = Math.cos(angle) * r;
        targets.DROP[i*3+1] = -250; 
        targets.DROP[i*3+2] = Math.sin(angle) * r;
    }

    // C. DINING
    const centers: {x:number, y:number, z:number}[] = [];
    
    for(let c=0; c<BOWL_COUNT; c++) {
        const center = randomSphere(350);
        centers.push(center);
    }
    for(let i=0; i<PARTICLE_COUNT; i++) {
        const center = centers[i % BOWL_COUNT];
        const r = Math.random() * 35;
        const theta = Math.random() * Math.PI * 2;
        targets.DINING[i*3] = center.x + r * Math.cos(theta);
        targets.DINING[i*3+1] = center.y + Math.random() * 20; 
        targets.DINING[i*3+2] = center.z + r * Math.sin(theta);
    }

    // D. HEART - SMALLER
    for(let i=0; i<PARTICLE_COUNT; i++) {
        const t = Math.random() * Math.PI * 2;
        const scale = 10; // Reduced from 15
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        
        const thickness = 8 + Math.random() * 8;
        
        targets.HEART[i*3] = x * scale + (Math.random()-0.5)*thickness;
        targets.HEART[i*3+1] = y * scale + (Math.random()-0.5)*thickness + 40; 
        targets.HEART[i*3+2] = (Math.random()-0.5) * 40; 
    }

    // E. GIO
    const txtCanvas = document.createElement('canvas');
    txtCanvas.width = 600; 
    txtCanvas.height = 300;
    const ctx = txtCanvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,600,300);
        ctx.fillStyle = '#fff';
        ctx.font = '900 200px Roboto, Arial, sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GIO', 300, 150);
        
        const imgData = ctx.getImageData(0,0,600,300);
        const validPixels: number[] = [];
        for(let y=0; y<300; y+=2) {
            for(let x=0; x<600; x+=2) {
                const idx = (y*600 + x)*4;
                if (imgData.data[idx] > 128) validPixels.push(idx/4); 
            }
        }
        for(let i=0; i<PARTICLE_COUNT; i++) {
            if (validPixels.length > 0) {
                const pxIndex = validPixels[Math.floor(Math.random() * validPixels.length)]; 
                const pxX = pxIndex % 600;
                const pxY = Math.floor(pxIndex / 600);
                targets.GIO[i*3] = (pxX - 300) * 1.5;
                targets.GIO[i*3+1] = -(pxY - 150) * 1.5;
                targets.GIO[i*3+2] = (Math.random()-0.5) * 10; 
            } else {
                 targets.GIO[i*3] = 0; targets.GIO[i*3+1] = 0; targets.GIO[i*3+2] = 0;
            }
        }
    }

    return { targets, centers };
};

export const StageAftermath: React.FC<StageAftermathProps> = ({ onRestart, mixedColors, ingredients, videoStream }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interaction Refs
  const switchBtnRef = useRef<HTMLButtonElement>(null);
  const giftBtnRef = useRef<HTMLButtonElement>(null);
  const restartBtnRef = useRef<HTMLButtonElement>(null);
  
  // State
  const [mode, setMode] = useState<VisualMode>('CHAOS');
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState(12400);
  const [isFist, setIsFist] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [activeGift, setActiveGift] = useState<LuxuryGift | null>(null);

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const bowlMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const spriteGroupRef = useRef<THREE.Group | null>(null);
  const eyeGroupRef = useRef<THREE.Group | null>(null);
  const nervesGroupRef = useRef<THREE.Group | null>(null);
  
  // Physics Refs
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const targetPositionsRef = useRef<Record<VisualMode, Float32Array> | null>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  const clusterCentersRef = useRef<{x:number, y:number, z:number}[]>([]);
  
  // Vision Refs
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const handResultsRef = useRef<any>(null);
  const faceResultsRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Eye Physics (Relative to Camera)
  const eyePhysicsRef = useRef([
      { x: -50, y: 50, z: -200, vx: 0, vy: 0, vz: 0, anchorX: -50, anchorY: 80 }, 
      { x: 50, y: 50, z: -200, vx: 0, vy: 0, vz: 0, anchorX: 50, anchorY: 80 }
  ]);
  
  // Gift Effect State
  const activeGiftEffectRef = useRef<{ type: string, timer: number } | null>(null);
  
  const explosionForceRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 }); 
  const mouseVectorRef = useRef(new THREE.Vector3());
  const cursorScreenPosRef = useRef({ x: 0, y: 0 }); 
  
  const frameIdRef = useRef<number>(0);
  const timeRef = useRef(0);
  const dummyRef = useRef(new THREE.Object3D());
  const fistTriggeredRef = useRef(false);
  const modeRef = useRef<VisualMode>('CHAOS');

  // Keep modeRef in sync with mode state
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // --- 0. VISION SETUP ---
  useEffect(() => {
    let isMounted = true;
    const setupVision = async () => {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            if (!isMounted) return;

            // Parallel creation
            const [hl, fl] = await Promise.all([
                 HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 1
                }),
                 FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                })
            ]);
            
            if (isMounted) {
                handLandmarkerRef.current = hl;
                faceLandmarkerRef.current = fl;
            } else {
                hl.close();
                fl.close();
            }
        } catch (e) {
            console.error("Vision Error", e);
        }
    };
    setupVision();
    return () => {
        isMounted = false;
        handLandmarkerRef.current?.close();
        faceLandmarkerRef.current?.close();
    };
  }, []);

  // Sync Video
  useEffect(() => {
    if (videoRef.current && videoStream) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play().catch(() => {});
        };
    }
  }, [videoStream]);

  // Texture Cache
  const ingredientTextures = useMemo(() => {
      const map = new Map<string, THREE.Texture>();
      const list = ingredients.length > 0 ? ingredients : ['🍅', '🥬', '🦴', '👁️', '🥓', '🍄']; 
      list.forEach(emoji => {
          if (!map.has(emoji)) {
              const cvs = document.createElement('canvas');
              cvs.width = 128; cvs.height = 128;
              const ctx = cvs.getContext('2d');
              if (ctx) {
                  ctx.clearRect(0, 0, 128, 128);
                  ctx.font = '90px serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(emoji, 64, 70);
              }
              const tex = new THREE.CanvasTexture(cvs);
              tex.colorSpace = THREE.SRGBColorSpace;
              map.set(emoji, tex);
          }
      });
      return { map, list };
  }, [ingredients]);

  // --- 2. INIT SCENE ---
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a); 

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    camera.position.z = 600;
    camera.position.y = 50;

    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current, 
        antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);
    
    const headLight = new THREE.DirectionalLight(0xffffff, 0.8);
    headLight.position.set(0, 0, 1);
    camera.add(headLight);
    scene.add(camera);

    const rimLight = new THREE.PointLight(0xff0000, 0.5, 1000);
    rimLight.position.set(-200, 100, -200);
    scene.add(rimLight);

    // --- MESHES ---
    // Generate shapes outside component and populate refs
    const { targets, centers } = generateShapes(width, height);
    targetPositionsRef.current = targets;
    clusterCentersRef.current = centers;
    
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const vels = new Float32Array(PARTICLE_COUNT * 3);

    const geometry = new THREE.IcosahedronGeometry(0.7, 0); 
    const material = new THREE.MeshPhysicalMaterial({
        roughness: 0.4,
        metalness: 0.1,
        flatShading: true,
        clearcoat: 0.8,
        color: 0xffffff
    });
    
    const mesh = new THREE.InstancedMesh(geometry, material, PARTICLE_COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    instancedMeshRef.current = mesh;

    // Bowls - Shorter and Warmer
    const bowlPoints = [];
    for (let i = 0; i < 10; i++) {
        // Wider (25) and shorter height step (2.5) for a shallower bowl
        bowlPoints.push(new THREE.Vector2(Math.sin(i * 0.2) * 25 + 8, (i - 5) * 2.5));
    }
    const bowlGeo = new THREE.LatheGeometry(bowlPoints, 30);
    // Warm color for ceramic feel
    const bowlMat = new THREE.MeshPhysicalMaterial({ 
        color: 0xffdab9, // Peach Puff
        roughness: 0.2,
        transmission: 0.4, // Less glass-like
        thickness: 2,
        clearcoat: 0.5,
        side: THREE.DoubleSide
    });
    const bowlMesh = new THREE.InstancedMesh(bowlGeo, bowlMat, BOWL_COUNT);
    bowlMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for(let i=0; i<BOWL_COUNT; i++) {
        dummyRef.current.position.set(0, -9000, 0);
        dummyRef.current.scale.set(0,0,0);
        dummyRef.current.updateMatrix();
        bowlMesh.setMatrixAt(i, dummyRef.current.matrix);
    }
    scene.add(bowlMesh);
    bowlMeshRef.current = bowlMesh;

    // Sprites
    const spriteGroup = new THREE.Group();
    scene.add(spriteGroup);
    spriteGroupRef.current = spriteGroup;
    
    let palette = mixedColors.length > 0 ? [...mixedColors] : ['#fbbf24', '#ef4444'];
    if (palette.length < 5) {
        const expanded: string[] = [];
        palette.forEach(hex => {
            const col = new THREE.Color(hex);
            expanded.push(hex);
            expanded.push('#' + col.clone().offsetHSL(0, 0, 0.1).getHexString());
            expanded.push('#' + col.clone().offsetHSL(0, 0, -0.1).getHexString());
        });
        palette = expanded;
    }
    const colorObj = new THREE.Color();
    const tempSprites: THREE.Sprite[] = [];

    for(let i=0; i<PARTICLE_COUNT; i++) {
        positions[i*3] = targets.CHAOS[i*3];
        positions[i*3+1] = targets.CHAOS[i*3+1];
        positions[i*3+2] = targets.CHAOS[i*3+2];

        const isIngredient = (i % INGREDIENT_DENSITY === 0);
        if (isIngredient) {
            const emoji = ingredientTextures.list[Math.floor(Math.random() * ingredientTextures.list.length)];
            const tex = ingredientTextures.map.get(emoji);
            const mat = new THREE.SpriteMaterial({ map: tex });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(45, 45, 1);
            spriteGroup.add(sprite);
            tempSprites.push(sprite);
            
            dummyRef.current.position.set(0,0,0);
            dummyRef.current.scale.set(0,0,0);
            dummyRef.current.updateMatrix();
            mesh.setMatrixAt(i, dummyRef.current.matrix);
        } else {
            const hex = palette[Math.floor(Math.random() * palette.length)]; 
            colorObj.set(hex);
            colorObj.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05); 
            mesh.setColorAt(i, colorObj);
            tempSprites.push(null as any); 
        }
    }
    
    (spriteGroup as any).userData.sprites = tempSprites;
    mesh.instanceColor!.needsUpdate = true;
    currentPositionsRef.current = positions;
    velocitiesRef.current = vels;

    // Eyes - ATTACH TO CAMERA
    const eyeGroup = new THREE.Group();
    camera.add(eyeGroup); // Key change: Attach to Camera
    eyeGroupRef.current = eyeGroup;
    
    // REDUCED EYE SIZE (Radius 14)
    const eyeG = new THREE.SphereGeometry(14, 32, 32);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupM = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(eyeG, eyeM);
    // PUPIL slightly smaller and adjusted Z
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(6), pupM); pupilL.position.z = 12; eyeL.add(pupilL);
    const eyeR = new THREE.Mesh(eyeG, eyeM);
    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(6), pupM); pupilR.position.z = 12; eyeR.add(pupilR);
    eyeGroup.add(eyeL); eyeGroup.add(eyeR);

    // Thick Nerves - Also attach to Camera
    const nervesGroup = new THREE.Group();
    camera.add(nervesGroup);
    nervesGroupRef.current = nervesGroup;
    
    // REDUCED NERVE THICKNESS to match smaller eyes
    const nerveGeo = new THREE.CylinderGeometry(3, 1, 1, 8); 
    const nerveMat = new THREE.MeshPhongMaterial({ color: 0x991b1b, shininess: 30 });
    const nerveL = new THREE.Mesh(nerveGeo, nerveMat);
    const nerveR = new THREE.Mesh(nerveGeo, nerveMat);
    nervesGroup.add(nerveL);
    nervesGroup.add(nerveR);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        // Resource Cleanup
        geometry.dispose();
        material.dispose();
        bowlGeo.dispose();
        bowlMat.dispose();
        eyeG.dispose();
        eyeM.dispose();
        pupilL.geometry.dispose();
        pupilL.material.dispose();
        pupilR.geometry.dispose();
        pupilR.material.dispose();
        nerveGeo.dispose();
        nerveMat.dispose();
        
        renderer.dispose();
    };
  }, [mixedColors, ingredientTextures]);

  // --- 3. ANIMATION LOOP ---
  useEffect(() => {
    const loop = () => {
        if (!instancedMeshRef.current || !targetPositionsRef.current || !currentPositionsRef.current) {
            frameIdRef.current = requestAnimationFrame(loop);
            return;
        }

        timeRef.current += 0.01;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const now = performance.now();

        // Vision
        if (handLandmarkerRef.current && videoRef.current && now - lastVideoTimeRef.current > 60) {
            if (videoRef.current.readyState >= 2) { 
              lastVideoTimeRef.current = now;
              
              try {
                  // Hand
                  const res = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
                  handResultsRef.current = res;
                  if (res.landmarks && res.landmarks.length > 0) {
                      const hand = res.landmarks[0];
                      const px = (1 - hand[9].x) * width; 
                      const py = hand[9].y * height;
                      
                      cursorScreenPosRef.current.x += (px - cursorScreenPosRef.current.x) * 0.3;
                      cursorScreenPosRef.current.y += (py - cursorScreenPosRef.current.y) * 0.3;
                      
                      mouseRef.current.x = (cursorScreenPosRef.current.x / width) * 2 - 1;
                      mouseRef.current.y = -(cursorScreenPosRef.current.y / height) * 2 + 1;

                      const tip = hand[12].y;
                      const pip = hand[10].y;
                      const fist = tip > pip;
                      setIsFist(fist);

                      let hovered: string | null = null;
                      const hitTest = (ref: React.RefObject<HTMLButtonElement>, id: string) => {
                          if(ref.current) {
                              const rect = ref.current.getBoundingClientRect();
                              const x = cursorScreenPosRef.current.x;
                              const y = cursorScreenPosRef.current.y;
                              if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                                  hovered = id;
                                  if (fist && !fistTriggeredRef.current) {
                                      ref.current.click();
                                  }
                              }
                          }
                      };
                      
                      hitTest(switchBtnRef, 'switch');
                      hitTest(giftBtnRef, 'gift');
                      hitTest(restartBtnRef, 'restart');
                      setHoveredBtn(hovered);

                      if (fist && !fistTriggeredRef.current) {
                          fistTriggeredRef.current = true;
                          if (cursorScreenPosRef.current.x < 150 && cursorScreenPosRef.current.y > height - 100) {
                              triggerLikes();
                          }
                      } else if (!fist) {
                          fistTriggeredRef.current = false;
                      }
                  }

                  // Face
                  if (faceLandmarkerRef.current) {
                       const faceRes = faceLandmarkerRef.current.detectForVideo(videoRef.current, now);
                       faceResultsRef.current = faceRes;
                  }
              } catch (e) {
                  console.warn("Vision detection error", e);
              }
            }
        }

        if (explosionForceRef.current > 0) explosionForceRef.current *= 0.9;
        
        // Gift Logic
        if (activeGiftEffectRef.current) {
            activeGiftEffectRef.current.timer -= 1;
            if (activeGiftEffectRef.current.timer <= 0) activeGiftEffectRef.current = null;
        }

        const target = targetPositionsRef.current[modeRef.current];
        const positions = currentPositionsRef.current;
        const vels = velocitiesRef.current!;
        const mesh = instancedMeshRef.current;
        const sprites = (spriteGroupRef.current as any).userData.sprites;
        const dummy = dummyRef.current;
        const camera = cameraRef.current!;
        const eyeGroup = eyeGroupRef.current;
        const bowlMesh = bowlMeshRef.current;
        const nervesGroup = nervesGroupRef.current;

        // Camera Orbit
        const r = 550 + Math.sin(timeRef.current * 0.5) * 50;
        const camX = r * Math.cos(timeRef.current * 0.2 + mouseRef.current.x * 0.5);
        const camZ = r * Math.sin(timeRef.current * 0.2 + mouseRef.current.x * 0.5);
        camera.position.x += (camX - camera.position.x) * 0.05;
        camera.position.z += (camZ - camera.position.z) * 0.05;
        camera.lookAt(0, 0, 0);

        mouseVectorRef.current.set(mouseRef.current.x, mouseRef.current.y, 0.5);
        mouseVectorRef.current.unproject(camera);
        mouseVectorRef.current.sub(camera.position).normalize();
        const distance = -camera.position.z / mouseVectorRef.current.z;
        const mouseWorld = camera.position.clone().add(mouseVectorRef.current.multiplyScalar(distance));

        // Bowls
        if (bowlMesh) {
             for(let i=0; i<BOWL_COUNT; i++) {
                 if (modeRef.current === 'DINING') {
                     const center = clusterCentersRef.current[i];
                     if(center) {
                         dummy.position.set(center.x, center.y - 10, center.z);
                         dummy.rotation.set(0, 0, 0); // Upright
                         dummy.scale.set(1, 1, 1);
                         dummy.position.y += Math.sin(timeRef.current * 2 + i) * 5;
                     }
                 } else {
                     dummy.scale.set(0,0,0);
                 }
                 dummy.updateMatrix();
                 bowlMesh.setMatrixAt(i, dummy.matrix);
             }
             bowlMesh.instanceMatrix.needsUpdate = true;
        }

        // Particles Physics
        for(let i=0; i<PARTICLE_COUNT; i++) {
            const idx = i*3;
            
            let tx = target[idx];
            let ty = target[idx+1];
            let tz = target[idx+2];

            const px = positions[idx];
            const py = positions[idx+1];
            const pz = positions[idx+2];

            let k = 0.02;
            
            if (modeRef.current === 'DROP') {
                k = 0; 
                vels[idx+1] -= 2.0; // Gravity
                if (py < -250) {
                    positions[idx+1] = -250;
                    vels[idx+1] *= -0.7; 
                    vels[idx] *= 0.95; 
                    vels[idx+2] *= 0.95; 
                }
                if (Math.abs(vels[idx+1]) < 0.5 && py <= -249) {
                     vels[idx+1] = 0; positions[idx+1] = -250;
                }
                vels[idx] += (tx - px) * 0.0005;
                vels[idx+2] += (tz - pz) * 0.0005;
            } else {
                vels[idx] += (tx - px) * k;
                vels[idx+1] += (ty - py) * k;
                vels[idx+2] += (tz - pz) * k;
            }

            const dx = px - mouseWorld.x;
            const dy = py - mouseWorld.y;
            const dz = pz - mouseWorld.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            if (distSq < 25000) {
                const f = (1 - Math.sqrt(distSq)/160) * 3.0;
                vels[idx] += (dx/Math.sqrt(distSq)) * f;
                vels[idx+1] += (dy/Math.sqrt(distSq)) * f;
                vels[idx+2] += (dz/Math.sqrt(distSq)) * f;
            }

            // Explosion Force
            if (explosionForceRef.current > 0.1) {
                 const ex = px, ey = py, ez = pz;
                 const d = Math.sqrt(ex*ex + ey*ey + ez*ez) + 0.1;
                 const f = explosionForceRef.current;
                 vels[idx] += (ex/d)*f; vels[idx+1] += (ey/d)*f; vels[idx+2] += (ez/d)*f;
            }

            // Gift Special Physics - REDUCED MAGNITUDE
            if (activeGiftEffectRef.current) {
                const type = activeGiftEffectRef.current.type;
                if (type === '🚀') {
                    // Rocket: Lift (Gentle)
                    if (Math.abs(px) < 100 && Math.abs(pz) < 100) vels[idx+1] += 0.8;
                } else if (type === '🏎️') {
                    // Car: Push Right (Gentle)
                    if (Math.abs(py) < 100) vels[idx] += 1.0;
                } else if (type === '🏰') {
                     // Mansion: Crush
                    vels[idx+1] -= 0.8;
                } else if (type === '💎') {
                    // Diamond: Freeze
                    vels[idx] *= 0.8; vels[idx+1] *= 0.8; vels[idx+2] *= 0.8;
                }
            }

            const friction = modeRef.current === 'DROP' ? 0.99 : 0.93; 
            vels[idx] *= friction;
            vels[idx+1] *= friction;
            vels[idx+2] *= friction;

            positions[idx] += vels[idx];
            positions[idx+1] += vels[idx+1];
            positions[idx+2] += vels[idx+2];

            const isIngredient = (i % INGREDIENT_DENSITY === 0);
            if (isIngredient) {
                const sprite = sprites[i];
                if (sprite) sprite.position.set(positions[idx], positions[idx+1], positions[idx+2]);
            } else {
                dummy.position.set(positions[idx], positions[idx+1], positions[idx+2]);
                const s = 6 + Math.sin(i + timeRef.current) * 3; 
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
        }
        
        mesh.instanceMatrix.needsUpdate = true;
        
        // Eyes & Nerves Update
        // Physics logic relative to Camera space (0,0 is center of screen view)
        if (eyeGroup && nervesGroup) {
            
            // Get Face Blendshapes for Eye Movement
            let eyeOffsetX = 0;
            let eyeOffsetY = 0;
            if (faceResultsRef.current && faceResultsRef.current.faceBlendshapes && faceResultsRef.current.faceBlendshapes.length > 0) {
                 const shapes = faceResultsRef.current.faceBlendshapes[0].categories;
                 const lookLeft = shapes.find(s => s.categoryName === 'eyeLookInLeft')?.score || 0;
                 const lookRight = shapes.find(s => s.categoryName === 'eyeLookOutLeft')?.score || 0;
                 const lookUp = shapes.find(s => s.categoryName === 'eyeLookUpLeft')?.score || 0;
                 const lookDown = shapes.find(s => s.categoryName === 'eyeLookDownLeft')?.score || 0;
                 
                 eyeOffsetX = (lookRight - lookLeft) * 60;
                 eyeOffsetY = (lookUp - lookDown) * 60;
            }

            eyePhysicsRef.current.forEach((eye, i) => {
                const mesh = eyeGroup.children[i];
                
                // Spring to anchor
                const dx = (eye.anchorX + eyeOffsetX) - eye.x;
                const dy = (eye.anchorY + eyeOffsetY) - eye.y; 
                const dz = -250 - eye.z; // Keep them at depth -250
                
                eye.vx += dx * 0.05; 
                eye.vy += dy * 0.05; 
                eye.vz += dz * 0.05;
                
                eye.vy -= 2.0; // Gravity relative to screen "down"

                // Bounds relative to camera frustum
                if (eye.y < -150) { eye.y = -150; eye.vy *= -0.5; }
                
                eye.vx *= 0.90; eye.vy *= 0.90; eye.vz *= 0.90;
                eye.x += eye.vx; eye.y += eye.vy; eye.z += eye.vz;
                
                mesh.position.set(eye.x, eye.y, eye.z);
                
                // Look forward
                mesh.rotation.set(0,0,0); 

                // Update Thick Nerve (Cylinder)
                const nerve = nervesGroup.children[i];
                
                // Anchor point (Top of screen relative to camera)
                const start = new THREE.Vector3(eye.anchorX, 400, -250); 
                const end = new THREE.Vector3(eye.x, eye.y, eye.z);
                
                // Vector math for perfect connection
                const direction = new THREE.Vector3().subVectors(end, start);
                const len = direction.length();
                
                // Position at midpoint
                nerve.position.copy(start).add(end).multiplyScalar(0.5);
                
                // Scale height to distance + slight overlap padding
                nerve.scale.set(1, len + 5, 1);
                
                // Orientation: Align Y (0,1,0) to direction vector using quaternions to prevent gaps
                nerve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
            });
        }

        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, []);

  // --- 4. CHAT GENERATOR ---
  useEffect(() => {
    // Extended Corpus (~50)
    const standardMsgs = [
        "PolyU U-Garden > Everything else", "My project group is meeting at 18:30 T_T", "I love the new lecture hall!", 
        "Anyone in Z Core library?", "Tutorial at 8:30am is cruel", "Just finished my FYP draft!", 
        "U-Garden pasta is legendary", "Can we get more sauce?", "Coding all night in the hub", 
        "React is surprisingly fun", "Who wants to join my hackathon team?", "The noodle physics are insane!",
        "PolyU design students are on another level", "I need coffee from the canteen", "Is the pool open?",
        "Assignment deadline in 2 hours...", "Senior Chef looks angry today", "Can I get a refund? JK",
        "This interactive art is cool", "WebGL magic!", "Spaghetti Monster for President", 
        "Why is the line so long?", "Best food on campus", "I'm hungry now", "Professor is watching...",
        "Groupmate is late again", "Presentation next week, nervous", "I love this community", 
        "Going to grab some dim sum after this", "PolyU campus is beautiful at night", "Need more sleep",
        "Code, Eat, Sleep, Repeat", "Debugging my life", "Jeng!", "世一!", "666", "Push to production!",
        "Frontend engineering is art", "Backend is magic", "Fullstack life", "Where is the library?",
        "Red brick walls forever", "Innovation tower is cool", "See you at the canteen", "Delicious!"
    ];

    const names = ["PastaFan99", "GourmetHunter", "HungryStudent", "BigBoss123", "NoodleKing", "SauceMaster", "ChefCurry", "FoodieHK", "SpaghettiLover", "CodeNinja", "PolyU_Ghost", "DesignGuru", "CompSci_Pro"];
    
    // Smart Venetanji messages (No Python)
    const vipMsgs = [
        "The particle entropy is beautifully calculated.",
        "Excellent architectural choice using Three.js instancing.",
        "The seamless state transition logic is impressive.",
        "Visually stunning representation of chaos theory.",
        "I appreciate the attention to physics detail.",
        "The shader performance is optimal on this device.",
        "This interaction model is intuitive and robust.",
        "A true masterpiece of creative coding.",
        "The frame rate stability is commendable."
    ];
    
    const interval = setInterval(() => {
        setComments(prev => {
            const isVip = Math.random() > 0.85; 
            
            let user = "";
            let text = "";
            let color = "#fbbf24";
            let isSpecial = false;

            if (isVip) {
                user = "venetanji";
                text = vipMsgs[Math.floor(Math.random() * vipMsgs.length)];
                color = "#a855f7"; 
                isSpecial = true;
            } else {
                user = names[Math.floor(Math.random() * names.length)];
                text = standardMsgs[Math.floor(Math.random() * standardMsgs.length)];
                color = "#fbbf24"; 
            }

            const newComment = {
                id: Date.now(),
                user: user,
                text: text,
                avatar: isVip ? "👨‍🏫" : AVATARS[Math.floor(Math.random() * AVATARS.length)],
                color: color,
                isGift: false,
                isVip: isSpecial
            };
            return [...prev, newComment].slice(-8); 
        });
        setLikes(l => l + Math.floor(Math.random() * 20));
    }, 1500); 
    return () => clearInterval(interval);
  }, []);

  // --- 5. HEARTS ANIMATION LOOP ---
  useEffect(() => {
      let animId = 0;
      const animateHearts = () => {
          setHearts(prev => {
              if (prev.length === 0) return prev;
              const next = prev.map(h => ({
                  ...h,
                  y: h.y + h.speed,
                  x: h.x + Math.sin(h.y * 0.1) * 0.5,
                  rotation: h.rotation + 2
              })).filter(h => h.y < 500); 
              return next;
          });
          animId = requestAnimationFrame(animateHearts);
      };
      animId = requestAnimationFrame(animateHearts);
      return () => cancelAnimationFrame(animId);
  }, []);

  const triggerLikes = () => {
      audio.playSFX('catch'); // Simple like sound
      setLikes(l => l + 1);
      
      const colors = ['#ef4444', '#eab308', '#3b82f6', '#ec4899', '#a855f7'];
      const icon = LIKE_ICONS[Math.floor(Math.random() * LIKE_ICONS.length)];
      
      const newHeart = {
          id: Date.now(),
          x: Math.random() * 60,
          y: 0,
          size: 20 + Math.random() * 20,
          type: icon,
          color: colors[Math.floor(Math.random() * colors.length)],
          speed: 2 + Math.random() * 3,
          wobbleOffset: Math.random() * 10,
          rotation: (Math.random()-0.5) * 30
      };
      setHearts(prev => [...prev, newHeart]);
  };

  const cycleMode = () => {
      audio.playSFX('switch'); // SFX
      const idx = MODES.indexOf(mode);
      const nextIdx = (idx + 1) % MODES.length;
      setMode(MODES[nextIdx]);
  };

  const sendGift = () => {
      audio.playSFX('gift'); // SFX
      explosionForceRef.current = 50.0;
      setLikes(l => l + 1000);
      const item = LUXURY_ITEMS[Math.floor(Math.random() * LUXURY_ITEMS.length)];
      setActiveGift({ id: Date.now(), ...item });
      activeGiftEffectRef.current = { type: item.emoji, timer: 120 }; // 2 seconds effect
      setTimeout(() => setActiveGift(null), 2500);
      setComments(p => [...p, {id:Date.now(), user:"YOU", text:`Sent a ${item.label} ${item.emoji}`, avatar:item.emoji, color:"#fff", isGift:true}].slice(-8));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (handResultsRef.current && handResultsRef.current.landmarks && handResultsRef.current.landmarks.length > 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
          cursorScreenPosRef.current.x = e.clientX - rect.left;
          cursorScreenPosRef.current.y = e.clientY - rect.top;
          mouseRef.current.x = (cursorScreenPosRef.current.x / rect.width) * 2 - 1;
          mouseRef.current.y = -(cursorScreenPosRef.current.y / rect.height) * 2 + 1;
      }
  };

  const renderCursor = () => {
      const hand = handResultsRef.current?.landmarks?.[0];
      const baseX = cursorScreenPosRef.current.x;
      const baseY = cursorScreenPosRef.current.y;
      const connections = HandLandmarker.HAND_CONNECTIONS;
      const scaleFactor = 50;
      const color = isFist ? '#ef4444' : '#fbbf24';

      return (
          <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            <svg className="w-full h-full">
                {hand && (
                    <g>
                       {connections.map((c, i) => {
                           const start = hand[c.start];
                           const end = hand[c.end];
                           const centerNode = hand[9];
                           const getX = (val: number) => baseX + ((1-val) - (1-centerNode.x)) * scaleFactor * 3;
                           const getY = (val: number) => baseY + (val - centerNode.y) * scaleFactor * 3;
                           return <line key={i} x1={getX(start.x)} y1={getY(start.y)} x2={getX(end.x)} y2={getY(end.y)} stroke={color} strokeWidth="3" strokeLinecap="round" />;
                       })}
                       {hand.map((lm: any, i: number) => {
                           const centerNode = hand[9];
                           const getX = (val: number) => baseX + ((1-val) - (1-centerNode.x)) * scaleFactor * 3;
                           const getY = (val: number) => baseY + (val - centerNode.y) * scaleFactor * 3;
                           return <circle key={i} cx={getX(lm.x)} cy={getY(lm.y)} r="4" fill={color} />;
                       })}
                    </g>
                )}
            </svg>
            
            <div 
                className="absolute transition-transform duration-75 ease-out"
                style={{
                    left: 0,
                    top: 0,
                    transform: `translate(${baseX}px, ${baseY}px)`,
                }}
            >
                 <div className="relative text-3xl">
                    <span className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl">
                        {isFist ? '✊' : '✋'}
                    </span>
                    <span className="absolute -translate-x-1/2 -translate-y-[150%] text-2xl animate-bounce">
                        👨‍🍳
                    </span>
                </div>
            </div>
          </div>
      );
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden cursor-none" onMouseMove={handleMouseMove}>
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline autoPlay muted />
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {renderCursor()}
      
      {/* DINING MODE SLOGAN - REFINED */}
      {mode === 'DINING' && (
          <div className="absolute top-1/4 w-full flex justify-center pointer-events-none z-30 animate-pulse">
              <div className="backdrop-blur-sm px-10 py-4 rounded-full shadow-[0_0_50px_rgba(251,191,36,0.3)]">
                  <h2 className="text-6xl font-['Indie_Flower'] font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-amber-300 to-yellow-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                      Welcome! Time to Eat!
                  </h2>
              </div>
          </div>
      )}
      
      {/* GIFT OVERLAY - REFINED CARD STYLE */}
      {activeGift && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden bg-black/40 backdrop-blur-[2px] transition-all duration-300">
               <div className="relative flex flex-col items-center px-12 py-10 rounded-3xl animate-legendary-drop transform scale-100 bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-yellow-500/30 shadow-[0_0_80px_rgba(234,179,8,0.2)] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-yellow-500/50 rounded-tl-3xl"></div>
                  <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-yellow-500/50 rounded-br-3xl"></div>

                  <span className="text-9xl filter drop-shadow-[0_10px_30px_rgba(255,215,0,0.3)] z-10 animate-bounce">{activeGift.emoji}</span>
                  
                  <div className="relative mt-8 z-20 text-center">
                      <span className="block text-sm text-yellow-500/80 font-mono tracking-[0.3em] uppercase mb-3">Legendary Gift</span>
                      <span className="block text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-600 tracking-wider uppercase drop-shadow-2xl">
                          {activeGift.label}
                      </span>
                  </div>
              </div>
          </div>
      )}

      {/* CHAT */}
      <div className="absolute top-1/4 bottom-1/4 left-6 w-64 pointer-events-none z-10 flex flex-col justify-end gap-2 mask-image-linear-to-t">
            {comments.map((c) => (
                <div key={c.id} className={`text-sm px-4 py-2 rounded-2xl backdrop-blur-md shadow-lg transform transition-all duration-500 animate-slide-up origin-left 
                    ${c.isGift 
                        ? 'bg-gradient-to-r from-yellow-500/80 to-orange-500/80 border-2 border-white' 
                        : c.isVip 
                            ? 'bg-gradient-to-r from-purple-600/90 to-indigo-600/90 border-2 border-yellow-300 shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                            : 'bg-black/40 border border-white/10'
                    }`}>
                    <div className="flex items-center gap-2">
                            <span className="text-lg">{c.avatar}</span>
                            <span className="font-bold text-shadow-sm truncate" style={{color: c.isVip ? '#fff' : c.color}}>
                                {c.user} {c.isVip && <span className="bg-yellow-400 text-black text-[10px] px-1 rounded ml-1">VIP</span>}
                            </span>
                    </div>
                    <p className={`leading-snug mt-1 ${c.isGift || c.isVip ? 'text-white font-bold' : 'text-white/90'}`}>{c.text}</p>
                </div>
            ))}
      </div>
      
      {/* FLOATING HEARTS (RIGHT) - 3D CSS */}
      <div className="absolute bottom-32 right-12 w-24 h-96 pointer-events-none z-20 overflow-visible">
          {hearts.map(h => (
              <div 
                key={h.id}
                className="absolute text-4xl filter drop-shadow-lg"
                style={{
                    bottom: `${h.y}px`,
                    right: `${h.x + Math.sin(h.y * 0.05 + h.wobbleOffset)*20}px`,
                    color: h.color,
                    fontSize: `${h.size}px`,
                    opacity: 1 - (h.y / 500),
                    transform: `rotateY(${h.rotation}deg) rotateZ(${h.y * 0.2}deg) translateZ(50px)`,
                    transformStyle: 'preserve-3d'
                }}
              >
                  {h.type}
              </div>
          ))}
      </div>

      {/* CONTROLS */}
      <div className="absolute bottom-10 left-10 pointer-events-auto flex items-center gap-4 z-40">
             <div onClick={triggerLikes} className="cursor-pointer bg-black/50 backdrop-blur text-white px-4 py-2 rounded-full font-bold shadow-lg border border-white/10 hover:bg-white/10 active:scale-95 transition-all select-none flex items-center gap-2">
                 <span className="text-red-500">❤️</span> {likes.toLocaleString()}
             </div>
             <button 
                ref={giftBtnRef} 
                onClick={sendGift} 
                className={`
                    px-6 py-2 rounded-full font-bold shadow-lg transition-all border border-white/20
                    ${hoveredBtn === 'gift' ? 'scale-110 ring-4 ring-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.6)]' : 'hover:scale-105'}
                    bg-gradient-to-r from-pink-500 to-rose-500 text-white animate-pulse
                `}
             >
                 🎁 Send Gift
             </button>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-4 z-40">
          <div className="text-white/30 font-mono text-xs tracking-[0.5em] uppercase mb-2">MODE: <span className="text-yellow-400 font-bold">{mode}</span></div>
          <button 
            ref={switchBtnRef} 
            onClick={cycleMode} 
            className={`
                group relative px-8 py-3 bg-transparent overflow-hidden rounded-full border border-white/20 transition-all 
                ${hoveredBtn === 'switch' ? 'scale-110 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'hover:border-yellow-400'}
            `}
          >
              <div className="absolute inset-0 w-0 bg-yellow-400 transition-all duration-[250ms] ease-out group-hover:w-full opacity-10"></div>
              <span className="relative text-white font-bold tracking-widest group-hover:text-yellow-400 transition-colors">SWITCH SHAPE ⟳</span>
          </button>
      </div>

      <div className="absolute bottom-10 right-10 pointer-events-auto z-40">
          <button 
            ref={restartBtnRef} 
            onClick={onRestart} 
            className={`
                bg-white/10 text-white px-6 py-2 rounded-lg backdrop-blur border border-white/10 transition-all font-mono tracking-wide
                ${hoveredBtn === 'restart' ? 'bg-white/30 scale-105 border-white' : 'hover:bg-white/20'}
            `}
          >
              RESTART
          </button>
      </div>

      <style>{`
        @keyframes slide-up { 0% { opacity: 0; transform: translateY(20px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes legendary-drop { 
            0% { transform: translateY(-50vh) scale(0) rotate(180deg); opacity: 0; } 
            70% { transform: translateY(10px) scale(1.2) rotate(-5deg); opacity: 1; } 
            100% { transform: translateY(0) scale(1) rotate(0deg); } 
        }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-legendary-drop { animation: legendary-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .mask-image-linear-to-t { mask-image: linear-gradient(to top, black 80%, transparent 100%); }
      `}</style>
    </div>
  );
};
