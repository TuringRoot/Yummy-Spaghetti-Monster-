
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface StageStatueProps {
    onBack: () => void;
    onRestart: () => void;
}

// SVG Pattern for the Grey Heart UI button - Base64 Encoded for robustness
const HEART_SVG_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgdmlld0JveD0nMCAwIDI0IDI0JyBmaWxsPSd3aGl0ZSc+PHBhdGggZD0nTTEyIDIxLjM1bC0xLjQ1LTEuMzJDNS40IDE1LjM2IDIgMTIuMjggMiA4LjUgMiA1LjQyIDQuNDIgMyA3LjUgM2MxLjc0IDAgMy40MS44MSA0LjUgMi4wOUMxMy4wOSAzLjgxIDE0Ljc2IDMgMTYuNSAzIDE5LjU4IDMgMjIgNS40MiAyMiA4LjVjMCAzLjc4LTMuNCA2Ljg2LTguNTUgMTEuNTRMMTIgMjEuMzV6Jy8+PC9zdmc+";

const HAIR_OPTIONS = [
    { id: '#5D4037', type: 'color', label: 'Chestnut Brown' }, // 栗子棕色
    { id: '#C4A484', type: 'color', label: 'Light Brown' }, // 浅棕色
    { id: '#FFD700', type: 'color', label: 'Gold' }, // 金色
    { id: '#98FF98', type: 'color', label: 'Mint' }, // 薄荷色
    { id: '#FFB7C5', type: 'color', label: 'Sakura Pink' }, // 樱花粉
    { 
        id: 'blue-dragon', 
        type: 'gradient', 
        label: 'Blue to Dragon', 
        gradient: 'linear-gradient(to bottom, #87CEFA 0%, #C71585 100%)' 
    }, // 头顶浅蓝到火龙果
    { 
        id: 'grey-hearts', 
        type: 'pattern', 
        label: 'Love Grey', 
        gradient: `url("${HEART_SVG_BASE64}") center/10px 10px repeat, #444444` 
    }, // 自然深灰有爱心
    { 
        id: 'macaron', 
        type: 'gradient', 
        label: 'Macaron', 
        gradient: 'linear-gradient(45deg, #FFB7B2, #FFDAC1, #E2F0CB, #B5EAD7, #C7CEEA)' 
    }, // 马卡龙彩虹
];

const HAIR_MODES = [
    { id: 'normal', label: 'Normal', icon: '👨‍💼' },  
    { id: 'full', label: 'Full', icon: '🦁' },      
    { id: 'afro', label: 'Afro', icon: '☁️' },
    { id: 'punk', label: 'Punk', icon: '🤘' },
    { id: 'pigtails', label: 'Pigtails', icon: '👧' },
];

const PYTHON_SNIPPETS = [
    "def cook_pasta():",
    "import antigravity",
    "while True:",
    "if al_dente:",
    "return sauce",
    "class Spaghetti(Monster):",
    "print('Hello World')",
    "sys.exit(0)",
    "lambda x: x * 2",
    "try: catch:",
    "await GIO.async()",
    "from __future__ import pizza",
    "x = [i for i in range(100)]",
    "def render(self):",
    "glMatrixMode(GL_PROJECTION)"
];

type GlassesType = 'frame' | 'cateye' | 'alien' | 'hand';

const GLASSES_ICONS: { id: GlassesType; label: string; icon: React.ReactNode }[] = [
    { 
        id: 'frame', 
        label: 'Classic',
        icon: (
            <svg viewBox="0 0 60 30" className="w-full h-full">
                <rect x="2" y="10" width="24" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
                <rect x="34" y="10" width="24" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
                <line x1="26" y1="15" x2="34" y2="15" stroke="currentColor" strokeWidth="3" />
            </svg>
        )
    },
    { 
        id: 'cateye', 
        label: 'Chic',
        icon: (
            <svg viewBox="0 0 60 30" className="w-full h-full">
                <path d="M2,12 C2,0 20,0 28,12 C28,22 15,28 2,22 Z" fill="currentColor" />
                <path d="M58,12 C58,0 40,0 32,12 C32,22 45,28 58,22 Z" fill="currentColor" />
                <path d="M28,15 L32,15" stroke="currentColor" strokeWidth="2" />
                <circle cx="15" cy="18" r="4" fill="#000" opacity="0.5" />
                <circle cx="45" cy="18" r="4" fill="#000" opacity="0.5" />
                {/* Tiny cat ear hint */}
                <path d="M50,2 L55,8 L45,8 Z" fill="currentColor" />
            </svg>
        )
    },
    { 
        id: 'alien', 
        label: 'Slime',
        icon: (
            <svg viewBox="0 0 60 30" className="w-full h-full">
                {/* Green Drip Frame */}
                <path d="M5,15 C5,5 25,5 25,15 C25,20 22,25 20,22 C18,25 12,25 10,22 C8,25 5,20 5,15 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M35,15 C35,5 55,5 55,15 C55,20 52,25 50,22 C48,25 42,25 40,22 C38,25 35,20 35,15 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                
                {/* Antennae */}
                <path d="M15,5 L10,-5" stroke="currentColor" strokeWidth="2" />
                <circle cx="10" cy="-5" r="3" fill="currentColor" />
                <path d="M45,5 L50,-5" stroke="currentColor" strokeWidth="2" />
                <circle cx="50" cy="-5" r="3" fill="currentColor" />
            </svg>
        )
    },
    { 
        id: 'hand', 
        label: 'Hands',
        icon: (
            <svg viewBox="0 0 60 30" className="w-full h-full">
                {/* Left Hand Icon */}
                <path d="M5,15 Q5,25 15,25 Q25,25 25,15 Q25,10 15,10 Q10,10 5,15" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M5,15 L2,5 M8,12 L8,2 M15,10 L15,0 M22,12 L25,4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                {/* Right Hand Icon */}
                <path d="M35,15 Q35,25 45,25 Q55,25 55,15 Q55,10 45,10 Q40,10 35,15" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M55,15 L58,5 M52,12 L52,2 M45,10 L45,0 M38,12 L35,4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        )
    }
];

interface GhostBubble {
    id: number;
    text: string;
    x: number;
    y: number;
    opacity: number;
    scale: number;
}

const GHOST_PHRASES = [
    "I have the secret recipe...",
    "Al Dente is the only way.",
    "My code is spaghetti, literally.",
    "Bow down to the Sauce!",
    "Infinite Noodles...",
    "Mamma Mia!",
    "Respect the Carbohydrates.",
    "Did you salt the water?",
    "I am the best Chef."
];

export const StageStatue: React.FC<StageStatueProps> = ({ onBack, onRestart }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- CUSTOMIZATION STATE ---
    const [hairStyleId, setHairStyleId] = useState('#5D4037');
    const [glassesStyle, setGlassesStyle] = useState<GlassesType>('frame');
    
    // Controls Beard Thickness/Length
    const [beardDensity, setBeardDensity] = useState(1.5);
    const [hairMode, setHairMode] = useState<string>('normal');

    // --- GHOST STATE ---
    const [ghostBubbles, setGhostBubbles] = useState<GhostBubble[]>([]);

    // Ghost Bubble Spawner
    useEffect(() => {
        const interval = setInterval(() => {
            const text = GHOST_PHRASES[Math.floor(Math.random() * GHOST_PHRASES.length)];
            setGhostBubbles(prev => [...prev, {
                id: Date.now(),
                text,
                x: (Math.random() - 0.5) * 40,
                y: 0, // Start at bottom relative to ghost container
                opacity: 1,
                scale: 0.5
            }]);
        }, 2500);

        const animFrame = setInterval(() => {
            setGhostBubbles(prev => prev.map(b => ({
                ...b,
                y: b.y + 1.2, // FLOAT UP
                opacity: b.opacity - 0.008,
                scale: Math.min(b.scale + 0.01, 1)
            })).filter(b => b.opacity > 0));
        }, 30);

        return () => {
            clearInterval(interval);
            clearInterval(animFrame);
        };
    }, []);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505); 
        scene.fog = new THREE.FogExp2(0x050505, 0.005);

        // Camera setup
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 5, 120); 
        camera.lookAt(0, 5, 0);

        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvasRef.current, 
            antialias: true, 
            alpha: false, 
            powerPreference: "high-performance"
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.6; // Brighter

        // --- LIGHTING ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Brighter
        scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0xffe0b2, 5.0); // Much Brighter
        spotLight.position.set(40, 60, 60);
        spotLight.angle = 0.6;
        spotLight.penumbra = 0.3;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;
        spotLight.shadow.bias = -0.0001;
        scene.add(spotLight);

        const rimLight = new THREE.SpotLight(0xffd700, 4.5);
        rimLight.position.set(-20, 50, -50);
        rimLight.lookAt(0, 0, 0);
        scene.add(rimLight);

        const fillLight = new THREE.DirectionalLight(0x4444ff, 1.0);
        fillLight.position.set(-50, -20, 50);
        scene.add(fillLight);

        // --- BACKGROUND GLOW ---
        const glowTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/glow.png');
        const glowMaterial = new THREE.SpriteMaterial({ 
            map: glowTexture, 
            color: 0xffaa00, 
            transparent: true, 
            opacity: 0.4,
            blending: THREE.AdditiveBlending 
        });
        const glowSprite = new THREE.Sprite(glowMaterial);
        glowSprite.scale.set(160, 160, 1);
        glowSprite.position.set(0, 15, -20);
        scene.add(glowSprite);

        // --- BACKGROUND CODE FLOATING EFFECT ---
        const codeGroup = new THREE.Group();
        codeGroup.position.z = -40; // Behind statue
        scene.add(codeGroup);

        const createCodeSprite = (text: string) => {
            const cvs = document.createElement('canvas');
            cvs.width = 512; cvs.height = 128;
            const ctx = cvs.getContext('2d');
            if (ctx) {
                ctx.font = 'bold 60px "Courier New", monospace';
                ctx.fillStyle = `rgba(0, 255, 100, ${0.3 + Math.random() * 0.4})`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 256, 64);
            }
            const tex = new THREE.CanvasTexture(cvs);
            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(40, 10, 1);
            return sprite;
        };

        const codeSprites: { sprite: THREE.Sprite, speed: number }[] = [];
        for (let i = 0; i < 25; i++) {
            const text = PYTHON_SNIPPETS[Math.floor(Math.random() * PYTHON_SNIPPETS.length)];
            const s = createCodeSprite(text);
            s.position.set(
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 150,
                (Math.random() - 0.5) * 50
            );
            codeGroup.add(s);
            codeSprites.push({ sprite: s, speed: 0.2 + Math.random() * 0.5 });
        }


        // --- HOLY PARTICLES ---
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 200;
        const posArray = new Float32Array(particlesCount * 3);
        for(let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 150;
        }
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.6,
            color: 0xffd700,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);

        // --- STATUE CONSTRUCTION ---
        const statueGroup = new THREE.Group();
        statueGroup.position.y = -14; 
        
        // --- MATERIAL GENERATION ---
        let hairMat: THREE.MeshStandardMaterial;
        
        // Complex Texture Generation Logic
        if (hairStyleId === 'blue-dragon') {
             const cvs = document.createElement('canvas');
             cvs.width = 128; cvs.height = 128;
             const ctx = cvs.getContext('2d');
             if(ctx) {
                 // Vertical Gradient: Light Blue to Magenta
                 const grd = ctx.createLinearGradient(0, 0, 0, 128);
                 grd.addColorStop(0, '#87CEFA'); 
                 grd.addColorStop(1, '#C71585'); 
                 ctx.fillStyle = grd;
                 ctx.fillRect(0, 0, 128, 128);
             }
             const tex = new THREE.CanvasTexture(cvs);
             tex.colorSpace = THREE.SRGBColorSpace;
             hairMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1 });

        } else if (hairStyleId === 'macaron') {
             const cvs = document.createElement('canvas');
             cvs.width = 128; cvs.height = 128;
             const ctx = cvs.getContext('2d');
             if(ctx) {
                 // Diagonal Pastel Rainbow
                 const grd = ctx.createLinearGradient(0, 0, 128, 128);
                 grd.addColorStop(0, '#FFB7B2');
                 grd.addColorStop(0.2, '#FFDAC1');
                 grd.addColorStop(0.4, '#E2F0CB');
                 grd.addColorStop(0.6, '#B5EAD7');
                 grd.addColorStop(0.8, '#C7CEEA');
                 grd.addColorStop(1, '#FFB7B2');
                 ctx.fillStyle = grd;
                 ctx.fillRect(0, 0, 128, 128);
             }
             const tex = new THREE.CanvasTexture(cvs);
             tex.colorSpace = THREE.SRGBColorSpace;
             hairMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });

        } else if (hairStyleId === 'grey-hearts') {
             const cvs = document.createElement('canvas');
             cvs.width = 256; cvs.height = 256;
             const ctx = cvs.getContext('2d');
             if(ctx) {
                 // Dark Grey Background
                 ctx.fillStyle = '#444444';
                 ctx.fillRect(0, 0, 256, 256);
                 
                 // Draw Hearts
                 ctx.fillStyle = '#ffffff';
                 const drawHeart = (x: number, y: number, s: number) => {
                     ctx.save();
                     ctx.translate(x, y);
                     ctx.scale(s, s);
                     ctx.beginPath();
                     ctx.moveTo(0, 0);
                     ctx.bezierCurveTo(-5, -5, -10, 0, 0, 10);
                     ctx.bezierCurveTo(10, 0, 5, -5, 0, 0);
                     ctx.fill();
                     ctx.restore();
                 };
                 
                 for(let i=0; i<40; i++) {
                     drawHeart(Math.random()*256, Math.random()*256, 1.5 + Math.random());
                 }
             }
             const tex = new THREE.CanvasTexture(cvs);
             tex.colorSpace = THREE.SRGBColorSpace;
             hairMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.0 });

        } else {
             // Standard Color
             hairMat = new THREE.MeshStandardMaterial({ color: hairStyleId, roughness: 0.5, metalness: 0.1 });
        }

        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc80, roughness: 0.3, metalness: 0.1 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5, metalness: 0.05 }); 
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.8 });
        
        // Glasses Materials
        const blackFrameMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.1, clearcoat: 1.0 });
        const pinkFrameMat = new THREE.MeshPhysicalMaterial({ color: 0xff4081, roughness: 0.2, metalness: 0.4, clearcoat: 0.8 });
        
        // Hand Glasses Materials
        const handRedMat = new THREE.MeshPhysicalMaterial({ color: 0xe11d48, roughness: 0.1, metalness: 0.2, clearcoat: 0.9 });
        const nailBlueMat = new THREE.MeshPhysicalMaterial({ color: 0x1e3a8a, roughness: 0.2, metalness: 0.3, clearcoat: 0.7 });
        
        // Alien Glasses Materials
        const slimeGreenMat = new THREE.MeshPhysicalMaterial({ color: 0x39FF14, roughness: 0.1, metalness: 0.1, transmission: 0.1, thickness: 1, clearcoat: 1.0 });
        const whiteLensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const blackPupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        const darkLensMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.0, metalness: 0.2, transparent: true, opacity: 0.5, clearcoat: 1.0 });

        const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        // 1. Base
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 12, 32), pedestalMat);
        pedestal.position.y = -16;
        pedestal.receiveShadow = true;
        statueGroup.add(pedestal);

        // 2. Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 14), shirtMat);
        torso.position.y = 5;
        torso.castShadow = true;
        statueGroup.add(torso);

        // 3. White Tie
        const tieStrip = new THREE.Mesh(new THREE.BoxGeometry(8, 22, 14.2), whiteMat);
        tieStrip.position.y = 5;
        statueGroup.add(tieStrip);
        const tieKnot = new THREE.Mesh(new THREE.BoxGeometry(8.2, 5, 14.5), whiteMat);
        tieKnot.position.y = 14;
        statueGroup.add(tieKnot);

        // 4. Arms
        const armGeo = new THREE.BoxGeometry(8, 22, 10);
        const armL = new THREE.Mesh(armGeo, shirtMat);
        armL.position.set(-18, 5, 0);
        armL.castShadow = true;
        statueGroup.add(armL);
        const armR = new THREE.Mesh(armGeo, shirtMat);
        armR.position.set(18, 5, 0);
        armR.castShadow = true;
        statueGroup.add(armR);

        // 5. Hands
        const handGeo = new THREE.BoxGeometry(8, 8, 10);
        const handL = new THREE.Mesh(handGeo, skinMat);
        handL.position.set(-18, -8, 2);
        statueGroup.add(handL);
        const handR = new THREE.Mesh(handGeo, skinMat);
        handR.position.set(18, -8, 2);
        statueGroup.add(handR);

        // 6. HEAD GROUP
        const headGroup = new THREE.Group();
        headGroup.position.y = 25.5; 
        statueGroup.add(headGroup);

        // --- FACE GEOMETRY (WIDER) ---
        // Increase width from 20 to 26
        const boxGeo = new THREE.BoxGeometry(26, 24, 20, 12, 12, 12);
        const positions = boxGeo.attributes.position;
        const vertex = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            const originalPos = vertex.clone();
            const normalized = vertex.clone().normalize().multiplyScalar(14); // Increased radius
            vertex.lerpVectors(originalPos, normalized, 0.65);
            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        boxGeo.computeVertexNormals();
        const face = new THREE.Mesh(boxGeo, skinMat);
        face.position.y = 1;
        face.castShadow = true;
        headGroup.add(face);

        // --- EYES ---
        const eyeGeo = new THREE.SphereGeometry(1, 24, 24); 
        const eyeSpacing = 5.5; // Slightly wider eyes
        const eyeY = 2;
        const eyeZ = 13.0; // Pushed out for wider head

        const pupilL = new THREE.Mesh(eyeGeo, pupilMat);
        pupilL.scale.set(1.8, 2.5, 1.5);
        pupilL.position.set(-eyeSpacing, eyeY, eyeZ);
        headGroup.add(pupilL);

        const pupilR = new THREE.Mesh(eyeGeo, pupilMat);
        pupilR.scale.set(1.8, 2.5, 1.5);
        pupilR.position.set(eyeSpacing, eyeY, eyeZ);
        headGroup.add(pupilR);

        // --- HAIR SYSTEM ---
        const hairGroup = new THREE.Group();
        headGroup.add(hairGroup);
        
        const createSmoothCap = (w:number, h:number, d:number, rad:number) => {
            const g = new THREE.BoxGeometry(w, h, d, 8, 8, 8);
            const p = g.attributes.position;
            const v = new THREE.Vector3();
            for(let i=0; i<p.count; i++){
                v.fromBufferAttribute(p, i);
                const o = v.clone();
                const n = v.clone().normalize().multiplyScalar(rad);
                v.lerpVectors(o, n, 0.65);
                p.setXYZ(i, v.x, v.y, v.z);
            }
            g.computeVertexNormals();
            return g;
        };

        if (hairMode === 'normal') {
            // UPDATED: Exposed forehead more by moving up (10->13) and back (-1->-3)
            const cap = new THREE.Mesh(createSmoothCap(27, 5, 20, 14), hairMat);
            cap.position.set(0, 13, -3); 
            hairGroup.add(cap);
            
            // Sideburns
            const sideGeo = new THREE.BoxGeometry(2, 6, 4);
            const sideL = new THREE.Mesh(sideGeo, hairMat);
            sideL.position.set(-13.5, 5, 1);
            hairGroup.add(sideL);
            const sideR = new THREE.Mesh(sideGeo, hairMat);
            sideR.position.set(13.5, 5, 1);
            hairGroup.add(sideR);

        } else if (hairMode === 'full') {
            // Old "Normal": Full thickness
            const cap = new THREE.Mesh(createSmoothCap(26, 8, 20, 15), hairMat);
            cap.position.set(0, 11, -2);
            hairGroup.add(cap);

        } else if (hairMode === 'afro') {
            // UPDATED: Higher, more volume, don't block face
            const afroGroup = new THREE.Group();
            const sphereGeo = new THREE.SphereGeometry(3.0, 8, 8); // Bigger spheres
            for(let i=0; i<120; i++) {
                const mesh = new THREE.Mesh(sphereGeo, hairMat);
                // Distribute on surface of a hemisphere
                const phi = Math.acos( -1 + ( 2 * i ) / 120 );
                const theta = Math.sqrt( 120 * Math.PI ) * phi;
                const r = 18; // Bigger radius
                mesh.position.setFromSphericalCoords(r, phi, theta);
                
                // Lift higher
                mesh.position.y += 6; 
                
                // Cull hair in front of face
                if (mesh.position.z > 6 && mesh.position.y < 14) {
                    continue; // Dont block eyes/face
                }
                
                afroGroup.add(mesh);
            }
            hairGroup.add(afroGroup);

        } else if (hairMode === 'punk') {
            // UPDATED: Spikes all over + 2 thin braids
            const spikeGeo = new THREE.ConeGeometry(2.5, 12, 8); // Bigger spikes
            
            // Spikes all over scalp
            for(let i=0; i<60; i++) {
                const spike = new THREE.Mesh(spikeGeo, hairMat);
                const phi = Math.acos( -1 + ( 2 * i ) / 60 );
                const theta = Math.sqrt( 60 * Math.PI ) * phi;
                const r = 13.5;
                
                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.cos(phi);
                const z = r * Math.sin(phi) * Math.sin(theta);
                
                // Avoid face
                if (z > 5 && y < 5) continue;

                const pos = new THREE.Vector3(x, y + 4, z);
                spike.position.copy(pos);
                // Orient spike outward
                spike.lookAt(0, 4, 0); 
                spike.rotateX(-Math.PI/2);
                
                hairGroup.add(spike);
            }

            // Two long thin braids - UPDATED POSITION FORWARD
            const createBraid = (isRight: boolean) => {
                const xSign = isRight ? 1 : -1;
                const points = [];
                // Move z from 0 to 8 to avoid clipping shoulder
                points.push(new THREE.Vector3(xSign * 13, 2, 8)); 
                points.push(new THREE.Vector3(xSign * 16, -10, 10));
                points.push(new THREE.Vector3(xSign * 14, -25, 14));
                points.push(new THREE.Vector3(xSign * 10, -35, 16)); 
                
                const curve = new THREE.CatmullRomCurve3(points);
                const geo = new THREE.TubeGeometry(curve, 24, 0.8, 6, false);
                return new THREE.Mesh(geo, hairMat);
            };
            
            hairGroup.add(createBraid(false));
            hairGroup.add(createBraid(true));

        } else if (hairMode === 'pigtails') {
            const cap = new THREE.Mesh(createSmoothCap(26, 6, 20, 14.5), hairMat);
            cap.position.set(0, 11, -2);
            hairGroup.add(cap);
            const bunGeo = new THREE.SphereGeometry(4.5, 16, 16);
            const bunL = new THREE.Mesh(bunGeo, hairMat);
            bunL.position.set(-18, 12, -2);
            hairGroup.add(bunL);
            const pathL = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-18, 12, -2), new THREE.Vector3(-22, 0, 0), new THREE.Vector3(-26, -15, 5), new THREE.Vector3(-24, -25, 8),
            ]);
            hairGroup.add(new THREE.Mesh(new THREE.TubeGeometry(pathL, 20, 2.5, 8, false), hairMat));
            const bunR = new THREE.Mesh(bunGeo, hairMat);
            bunR.position.set(18, 12, -2);
            hairGroup.add(bunR);
            const pathR = new THREE.CatmullRomCurve3([
                new THREE.Vector3(18, 12, -2), new THREE.Vector3(22, 0, 0), new THREE.Vector3(26, -15, 5), new THREE.Vector3(24, -25, 8),
            ]);
            hairGroup.add(new THREE.Mesh(new THREE.TubeGeometry(pathR, 20, 2.5, 8, false), hairMat));
        }

        // --- GLASSES ---
        const glassesGroup = new THREE.Group();
        glassesGroup.position.set(0, eyeY, eyeZ + 0.8);
        
        if (glassesStyle === 'frame') {
            // OPTIMIZED: Continuous, rounded, NARROWER tube frame with NO LENSES
            const makeRoundedRectTube = (xOffset: number) => {
                const width = 5.0; // Slightly wider box
                const height = 2.0; // NARROWER VERTICALLY
                const curve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(xOffset - width, height, 0),
                    new THREE.Vector3(xOffset + width, height, 0),
                    new THREE.Vector3(xOffset + width, -height, 0),
                    new THREE.Vector3(xOffset - width, -height, 0)
                ], true, 'catmullrom', 0.2); 

                const geometry = new THREE.TubeGeometry(curve, 64, 0.8, 12, true);
                const mesh = new THREE.Mesh(geometry, blackFrameMat);
                // NO LENS MESH ADDED
                return mesh;
            };

            // WIDER SPACING (xOffset increased)
            glassesGroup.add(makeRoundedRectTube(-7.5));
            glassesGroup.add(makeRoundedRectTube(7.5));

            // Bridge (Wider)
            const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 5.0, 8), blackFrameMat);
            bridge.rotation.z = Math.PI / 2;
            glassesGroup.add(bridge);

            // Arms
            const armGeo = new THREE.BoxGeometry(0.8, 0.8, 14);
            const armL = new THREE.Mesh(armGeo, blackFrameMat);
            armL.position.set(-13, 1, -6);
            glassesGroup.add(armL);
            const armR = new THREE.Mesh(armGeo, blackFrameMat);
            armR.position.set(13, 1, -6);
            glassesGroup.add(armR);

        } else if (glassesStyle === 'cateye') {
            // OPTIMIZED REBUILD with Cat Icon
            const makeCatEyeLens = (isRight: boolean) => {
                 const xSign = isRight ? 1 : -1;
                 const g = new THREE.Group();
                 
                 // Shape definition for ONE side
                 const shape = new THREE.Shape();
                 shape.moveTo(0, -3);
                 shape.quadraticCurveTo(5, -3, 7, 2); // Outer bottom corner to top outer
                 shape.quadraticCurveTo(0, 5, -5, 2); // Top inner
                 shape.quadraticCurveTo(-3, -3, 0, -3); // Inner bottom back to start

                 const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.3, bevelThickness: 0.3 });
                 geom.center(); 
                 
                 const frame = new THREE.Mesh(geom, pinkFrameMat);
                 frame.rotation.z = isRight ? 0.15 : -0.15;
                 g.add(frame);
                 
                 // Inner Lens
                 const lensShape = new THREE.Shape();
                 lensShape.moveTo(0, -2);
                 lensShape.quadraticCurveTo(4, -2, 5.5, 1.5);
                 lensShape.quadraticCurveTo(0, 3.5, -4, 1.5);
                 lensShape.quadraticCurveTo(-2, -2, 0, -2);
                 const lensGeom = new THREE.ShapeGeometry(lensShape);
                 lensGeom.center();
                 const lens = new THREE.Mesh(lensGeom, darkLensMat);
                 lens.position.z = 0.5;
                 lens.rotation.z = isRight ? 0.15 : -0.15;
                 g.add(lens);
                 
                 // ADD CAT ICON DECORATION
                 if (isRight) {
                     const catGroup = new THREE.Group();
                     const head = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), goldMat);
                     catGroup.add(head);
                     const earL = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 3), goldMat);
                     earL.position.set(-0.8, 1.0, 0);
                     earL.rotation.z = 0.5;
                     catGroup.add(earL);
                     const earR = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 3), goldMat);
                     earR.position.set(0.8, 1.0, 0);
                     earR.rotation.z = -0.5;
                     catGroup.add(earR);
                     
                     catGroup.position.set(5.5, 3.5, 1.2);
                     catGroup.rotation.z = -0.2;
                     g.add(catGroup);
                 }

                 return g;
            };

            const left = makeCatEyeLens(false);
            left.position.set(-6, 0.5, 0);
            glassesGroup.add(left);

            const right = makeCatEyeLens(true);
            right.position.set(6, 0.5, 0);
            glassesGroup.add(right);
            
            // Bridge
            const bridge = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 0.5), pinkFrameMat);
            bridge.position.y = 0.5;
            glassesGroup.add(bridge);

            // Arms
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 12), pinkFrameMat);
            armL.position.set(-11, 2, -5);
            glassesGroup.add(armL);
            const armR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 12), pinkFrameMat);
            armR.position.set(11, 2, -5);
            glassesGroup.add(armR);

        } else if (glassesStyle === 'alien') {
             // SCALED UP (1.35x)
             const scaleFactor = 1.35;
             const makeAlienEye = (isRight: boolean) => {
                 const g = new THREE.Group();
                 const xDir = isRight ? 1 : -1;

                 // 1. Green Frame Housing (Sphere-ish)
                 const frameGeo = new THREE.SphereGeometry(3.5, 32, 16);
                 const frame = new THREE.Mesh(frameGeo, slimeGreenMat);
                 frame.scale.set(1.2, 1, 0.5);
                 g.add(frame);

                 // 2. White Eye Ball (Main Lens)
                 const lensGeo = new THREE.SphereGeometry(2.5, 32, 16);
                 const lens = new THREE.Mesh(lensGeo, whiteLensMat);
                 lens.position.z = 1.0;
                 lens.scale.set(1.1, 1, 0.4);
                 g.add(lens);

                 // 3. Black Pupil (Main) - Vertical Slit or Round? Reference says Round with dot
                 const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), blackPupilMat);
                 pupil.position.z = 2.05;
                 g.add(pupil);

                 // 4. Drips (Bottom)
                 const drip1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 8), slimeGreenMat);
                 drip1.position.set(1 * xDir, -3.5, 0);
                 drip1.rotation.z = Math.PI;
                 g.add(drip1);

                 const drip2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8), slimeGreenMat);
                 drip2.position.set(-1.5 * xDir, -3, 0.2);
                 drip2.rotation.z = Math.PI;
                 g.add(drip2);

                 // 5. Antennae Stalk
                 // Curve going up and out
                 const curve = new THREE.CatmullRomCurve3([
                     new THREE.Vector3(0, 3, 0),
                     new THREE.Vector3(1 * xDir, 6, -1),
                     new THREE.Vector3(2.5 * xDir, 8, 0),
                 ]);
                 const stalk = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.4, 8, false), slimeGreenMat);
                 g.add(stalk);

                 // 6. Antennae Eye (Top)
                 const topEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), whiteLensMat);
                 topEye.position.set(2.5 * xDir, 8, 0);
                 g.add(topEye);
                 
                 const topPupil = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), blackPupilMat);
                 topPupil.position.set(2.5 * xDir, 8, 1.0);
                 g.add(topPupil);

                 return g;
             };

             // CLOSER IPD
             const lEye = makeAlienEye(false);
             lEye.position.set(-4.8 * scaleFactor, 0, 0); // Closer
             lEye.rotation.y = 0.2;
             lEye.scale.setScalar(scaleFactor); 
             glassesGroup.add(lEye);

             const rEye = makeAlienEye(true);
             rEye.position.set(4.8 * scaleFactor, 0, 0); // Closer
             rEye.rotation.y = -0.2;
             rEye.scale.setScalar(scaleFactor); 
             glassesGroup.add(rEye);
             
             // Bridge
             const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3 * scaleFactor, 8), slimeGreenMat);
             bridge.rotation.z = Math.PI / 2;
             glassesGroup.add(bridge);

        } else if (glassesStyle === 'hand') {
            // SCALED UP (1.35x)
            const scaleFactor = 1.35;
            
            const makeHandFrame = (isRight: boolean) => {
                const g = new THREE.Group();
                const sign = isRight ? 1 : -1;
                
                const palmGeo = new THREE.TorusGeometry(3.5, 1.0, 16, 32); 
                const palm = new THREE.Mesh(palmGeo, handRedMat);
                palm.scale.set(1.2, 1.0, 1); 
                g.add(palm);

                const fingerGeo = new THREE.CapsuleGeometry(0.6, 3.5, 4, 8);
                const startAngle = isRight ? -0.2 : 3.3; 
                const spread = isRight ? 0.5 : -0.5;

                for(let i=0; i<4; i++) {
                    const finger = new THREE.Mesh(fingerGeo, handRedMat);
                    const angle = startAngle + (i * spread);
                    const r = 3.5; 
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    finger.position.set(x, y, 0);
                    finger.rotation.z = angle - Math.PI/2;
                    finger.translateY(1.5);
                    const nail = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 0.8, 4, 4), nailBlueMat);
                    nail.position.y = 1.8; 
                    finger.add(nail);
                    g.add(finger);
                }

                const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 3, 4, 8), handRedMat);
                thumb.position.set(isRight ? -3.5 : 3.5, -1, 0); 
                thumb.rotation.z = isRight ? 0.5 : -0.5;
                g.add(thumb);
                
                const lens = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), darkLensMat);
                lens.position.z = 0.2;
                g.add(lens);
                
                // Scale the whole hand group
                g.scale.setScalar(scaleFactor);

                return g;
            };

            const leftHand = makeHandFrame(false);
            leftHand.position.x = -6 * scaleFactor;
            glassesGroup.add(leftHand);

            const rightHand = makeHandFrame(true);
            rightHand.position.x = 6 * scaleFactor;
            glassesGroup.add(rightHand);
            
            const bridge = new THREE.Mesh(new THREE.BoxGeometry(2 * scaleFactor, 1, 0.5), handRedMat);
            glassesGroup.add(bridge);
        }

        headGroup.add(glassesGroup);

        // --- MUSTACHE ---
        const stacheGroup = new THREE.Group();
        stacheGroup.position.set(0, -3.5, 12); 
        const stacheLen = 4.5;
        const stacheThick = 1.2;
        const stacheGeo = new THREE.CapsuleGeometry(stacheThick, stacheLen, 4, 8);
        const stacheL = new THREE.Mesh(stacheGeo, hairMat);
        stacheL.position.set(-stacheLen/2 - 0.5, -2, 0);
        stacheL.rotation.z = -Math.PI / 4; 
        stacheGroup.add(stacheL);
        const stacheR = new THREE.Mesh(stacheGeo, hairMat);
        stacheR.position.set(stacheLen/2 + 0.5, -2, 0);
        stacheR.rotation.z = Math.PI / 4; 
        stacheGroup.add(stacheR);
        headGroup.add(stacheGroup);

        // --- BEARD ---
        const beardGroup = new THREE.Group();
        beardGroup.position.set(0, -9, 15);
        const tubeThickness = 1.2 * beardDensity; 
        const radius = 6.0; 
        const chinGeo = new THREE.TorusGeometry(radius, tubeThickness, 8, 24, Math.PI);
        const chin = new THREE.Mesh(chinGeo, hairMat);
        chin.rotation.z = Math.PI; 
        chin.scale.set(1, 1 + (beardDensity - 1) * 0.5, 1);
        beardGroup.add(chin);
        headGroup.add(beardGroup);

        // 7. GOLDEN HALO
        const haloGeo = new THREE.TorusGeometry(25, 1, 16, 100);
        const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.set(0, 30, -10);
        statueGroup.add(halo);

        // 8. PASTA (ANIMATED SHADER)
        const pastaUniforms = { time: { value: 0 } };
        const pastaMat = new THREE.MeshStandardMaterial({ 
            color: 0xffe082, roughness: 0.4, metalness: 0.1, emissive: 0xffa000, emissiveIntensity: 0.2
        });
        
        // Inject Shader Logic for Waving
        pastaMat.onBeforeCompile = (shader) => {
            shader.uniforms.time = pastaUniforms.time;
            shader.vertexShader = `
                uniform float time;
                ${shader.vertexShader}
            `;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // Animated Waving Logic - Flying Effect
                float wave1 = sin(time * 5.0 + position.y * 0.2); 
                float wave2 = cos(time * 4.3 + position.y * 0.25);
                float wave3 = sin(time * 2.0 + position.z * 0.1); 

                // Stronger intensity further down to simulate wild movement
                float intensity = clamp(abs(position.y + 8.0) * 0.15, 0.0, 8.0); 

                transformed.x += wave1 * intensity * 3.0;
                transformed.y += wave3 * intensity * 1.5; 
                transformed.z += wave2 * intensity * 3.0;
                `
            );
        };

        const createPastaStrand = (start: THREE.Vector3, seed: number) => {
            const points = [];
            points.push(start.clone());
            // Deterministic "Randomness" using sine of seed
            const r1 = Math.sin(seed * 1.1) * 15;
            const r2 = Math.cos(seed * 1.2) * 5;
            const r3 = Math.sin(seed * 1.3) * 25;
            const r4 = Math.cos(seed * 1.4) * 10;
            
            points.push(start.clone().add(new THREE.Vector3(r1, -10 - Math.abs(r2), 5)));
            points.push(start.clone().add(new THREE.Vector3(r3, -30 - Math.abs(r4), 10)));
            const curve = new THREE.CatmullRomCurve3(points);
            return new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.7, 8, false), pastaMat);
        };

        for(let i=0; i<8; i++) {
            statueGroup.add(createPastaStrand(new THREE.Vector3(-18, -8, 2), i));
            statueGroup.add(createPastaStrand(new THREE.Vector3(18, -8, 2), i + 100));
        }

        scene.add(statueGroup);

        // --- ANIMATION ---
        let frameId = 0;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            const t = Date.now() * 0.001;
            
            // Update Uniforms
            pastaUniforms.time.value = t;

            statueGroup.rotation.y = Math.sin(t * 0.3) * 0.1;
            statueGroup.position.y = -14 + Math.sin(t * 0.8) * 1.5;
            halo.rotation.z = t * 0.2;
            halo.rotation.x = Math.sin(t * 0.5) * 0.1;
            glowSprite.scale.setScalar(160 + Math.sin(t * 2) * 10);
            glowSprite.material.opacity = 0.4 + Math.sin(t * 1.5) * 0.1;
            particlesMesh.rotation.y = t * 0.05;

            // Animate Code
            for (const item of codeSprites) {
                item.sprite.position.y += item.speed;
                if (item.sprite.position.y > 100) item.sprite.position.y = -100;
            }

            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
             if (containerRef.current && renderer) {
                 const w = containerRef.current.clientWidth;
                 const h = containerRef.current.clientHeight;
                 camera.aspect = w / h;
                 camera.updateProjectionMatrix();
                 renderer.setSize(w, h);
             }
        };
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameId);
            renderer.dispose();
            glowTexture.dispose();
            skinMat.dispose(); hairMat.dispose(); shirtMat.dispose();
            whiteMat.dispose(); blackFrameMat.dispose(); pinkFrameMat.dispose(); 
            handRedMat.dispose(); nailBlueMat.dispose();
            slimeGreenMat.dispose(); whiteLensMat.dispose(); blackPupilMat.dispose(); darkLensMat.dispose(); 
            pedestalMat.dispose(); haloMat.dispose(); pupilMat.dispose(); goldMat.dispose();
        };

    }, [hairStyleId, glassesStyle, beardDensity, hairMode]);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <canvas ref={canvasRef} className="block w-full h-full" />
            
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black pointer-events-none"></div>

            {/* --- TOP CENTER: TITLE --- */}
            <div className="absolute top-8 w-full flex flex-col items-center justify-center pointer-events-none z-20">
                 <div className="flex items-center gap-3 mb-2 opacity-80 animate-slide-in-down">
                     <div className="w-8 h-[1px] bg-yellow-500"></div>
                     <span className="text-yellow-500 font-mono text-xs tracking-widest uppercase shadow-black drop-shadow-md">Homage to GIO</span>
                     <div className="w-8 h-[1px] bg-yellow-500"></div>
                 </div>
                 <h1 className="text-3xl md:text-5xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-300 to-yellow-600 drop-shadow-[0_4px_10px_rgba(0,0,0,1)] text-center leading-tight animate-slide-in-down delay-100">
                    PROFESSOR OF THE<br/>DIGITAL PASTA GOD
                 </h1>
            </div>

            {/* --- TOP LEFT: QUOTE --- */}
            <div className="absolute top-8 left-8 z-20 pointer-events-none animate-fade-in delay-500 hidden md:block">
                 <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 max-w-xs shadow-2xl">
                    <p className="text-gray-300 font-sans text-xs italic leading-relaxed border-l-2 border-yellow-500 pl-3">
                       "In code we trust, in pasta we thrust.<br/>May your algorithms be al dente."
                    </p>
                 </div>
            </div>

            {/* --- LEFT: CUSTOMIZATION PANEL --- */}
            <div className="absolute left-8 top-[35%] -translate-y-1/2 z-40 bg-neutral-900/80 backdrop-blur-lg p-5 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] w-64 animate-slide-in-left max-h-[85vh] overflow-y-auto">
                <div className="text-xs text-yellow-500 font-mono uppercase tracking-widest mb-4 border-b border-white/10 pb-2">
                    Statue Config
                </div>
                
                {/* Glasses */}
                <div className="mb-4">
                    <label className="text-white/70 text-xs font-bold block mb-2">Eyewear</label>
                    <div className="grid grid-cols-2 gap-2">
                        {GLASSES_ICONS.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setGlassesStyle(item.id)}
                                className={`relative h-14 rounded-lg border transition-all overflow-hidden group
                                    ${glassesStyle === item.id 
                                        ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 border-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)]' 
                                        : 'bg-black/40 border-white/10 hover:border-white/40 hover:bg-white/5'
                                    }`}
                            >
                                <div className={`absolute inset-0 p-2 opacity-90 transition-transform duration-300 group-hover:scale-110 flex items-center justify-center ${glassesStyle === item.id ? 'text-black' : 'text-gray-300'}`}>
                                    <div className="w-12 h-12">
                                        {item.icon}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Beard Density Slider */}
                <div className="mb-4">
                    <div className="flex justify-between mb-1">
                        <label className="text-white/70 text-xs font-bold">Beard Density</label>
                        <span className="text-white/50 text-[10px]">{beardDensity.toFixed(1)}</span>
                    </div>
                    <input 
                        type="range" min="0.5" max="2.5" step="0.1" 
                        value={beardDensity}
                        onChange={(e) => setBeardDensity(parseFloat(e.target.value))}
                        className="w-full accent-yellow-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Hair Mode Selector */}
                <div className="mb-4">
                    <label className="text-white/70 text-xs font-bold block mb-2">Hair Style</label>
                    <div className="flex gap-2 flex-wrap">
                        {HAIR_MODES.map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setHairMode(mode.id)}
                                className={`flex items-center justify-center gap-1 w-[45%] py-2 text-[10px] font-bold rounded border transition-all
                                    ${hairMode === mode.id
                                        ? 'bg-yellow-500 text-black border-yellow-500' 
                                        : 'bg-black/50 text-white border-white/20 hover:border-white/50'
                                    }`}
                            >
                                <span>{mode.icon}</span> {mode.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Hair Color */}
                <div className="mb-2">
                    <label className="text-white/70 text-xs font-bold block mb-2">Hair Color</label>
                    <div className="flex gap-2 flex-wrap">
                        {HAIR_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setHairStyleId(opt.id)}
                                title={opt.label}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${hairStyleId === opt.id ? 'border-white scale-110 ring-2 ring-yellow-500/50' : 'border-transparent'}`}
                                style={{ 
                                    background: opt.type === 'color' ? opt.id : opt.gradient,
                                    backgroundSize: 'cover'
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Interactive Ghost */}
            <div className="absolute top-[65%] -translate-y-1/2 right-8 md:right-16 z-30 flex flex-col items-center group cursor-pointer">
                {/* Floating Bubbles */}
                <div className="absolute bottom-full mb-4 w-64 pointer-events-none h-64 overflow-visible">
                    {ghostBubbles.map(b => (
                         <div 
                            key={b.id}
                            className="absolute bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-mono whitespace-nowrap border border-white/10"
                            style={{
                                left: '50%',
                                bottom: `${b.y + 20}px`, 
                                transform: `translateX(-50%) translateX(${b.x}px) scale(${b.scale})`,
                                opacity: b.opacity
                            }}
                         >
                            {b.text}
                         </div>
                    ))}
                </div>

                {/* Ghost Body */}
                <div className="relative animate-float group-hover:animate-none group-hover:-translate-y-2 transition-transform duration-500">
                    <div className="text-8xl md:text-9xl filter drop-shadow-[0_0_40px_rgba(251,146,60,0.5)] opacity-90 group-hover:opacity-100 transition-opacity">
                        👻
                    </div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-5xl animate-spin-slow opacity-60 filter drop-shadow-[0_0_15px_gold]">
                        🍝
                    </div>
                </div>

                {/* Chat Button Below - OPTIMIZED WARM COLORS */}
                <a 
                    href="https://chattingwithspaghettimonster.netlify.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-full shadow-[0_0_20px_rgba(234,88,12,0.5)] backdrop-blur transition-all transform tracking-widest hover:scale-105 active:scale-95 border border-orange-400"
                >
                    CHAT NOW
                </a>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-12 w-full flex justify-center gap-6 pointer-events-auto z-30 px-6">
                <button 
                    onClick={onBack}
                    className="group relative overflow-hidden px-8 py-3 bg-neutral-900/50 border border-red-500/30 text-red-100/80 font-mono text-sm rounded-lg hover:border-red-500 hover:text-white transition-all active:scale-95 shadow-lg backdrop-blur-md min-w-[160px]"
                >
                    <span className="relative z-10 flex items-center justify-center gap-3 font-bold">
                        <span>🤮</span> SPIT EYES
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-red-900/40 to-red-800/40 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
                
                <button 
                    onClick={onRestart}
                    className="group relative overflow-hidden px-8 py-3 bg-neutral-900/50 border border-yellow-500/30 text-yellow-100/80 font-mono text-sm rounded-lg hover:border-yellow-400 hover:text-white transition-all active:scale-95 shadow-lg backdrop-blur-md min-w-[160px]"
                >
                    <span className="relative z-10 flex items-center justify-center gap-3 font-bold">
                        RESTART <span className="text-lg group-hover:rotate-180 transition-transform duration-500">↺</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-700/40 to-yellow-600/40 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
            </div>
            
            <style>{`
                .bg-radial-gradient { background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 100%); }
                @keyframes slide-in-down { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-in-down { animation: slide-in-down 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                
                @keyframes slide-in-left { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
                .animate-slide-in-left { animation: slide-in-left 0.8s ease-out forwards; }
                
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 1s ease-out forwards; }

                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
                .animate-float { animation: float 4s ease-in-out infinite; }
                
                @keyframes spin-slow { from { transform: translateX(-50%) rotate(0deg); } to { transform: translateX(-50%) rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 10s linear infinite; }
                
                @keyframes pulse-slow { 0%, 100% { opacity: 0.9; transform: scale(1); } 50% { opacity: 1; transform: scale(1.02); } }
                .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
            `}</style>
        </div>
    );
};
