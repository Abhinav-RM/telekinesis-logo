/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Sparkles, Hand } from 'lucide-react';

// --- Constants ---
const GRID_X = 15;
const GRID_Y = 10;
const HINDI_CHARS = ['अ', 'क', 'म', 'उ', 'ड', 'ा', 'न', 'स', 'र', 'त', 'प', 'ल'];
const LOGO_IMAGE_URL = '1000040494.jpg'; // Using the filename provided by the user

// --- Types ---
interface Shard {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  initialX: number;
  initialY: number;
  u: number;
  v: number;
  w: number;
  h: number;
  rotation: number;
  initialRotation: number;
}

interface Bird {
  x: number;
  y: number;
  speed: number;
  scale: number;
  wingPhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  life: number;
  size: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pinchDistance, setPinchDistance] = useState(1); // 1 = fully open, 0 = fully pinched
  const [isAssembled, setIsAssembled] = useState(false);

  // Refs for animation state to avoid re-renders
  const stateRef = useRef({
    shards: [] as Shard[],
    birds: [] as Bird[],
    particles: [] as Particle[],
    ambientChars: [] as { x: number; y: number; char: string; speed: number; opacity: number }[],
    logoImage: null as HTMLImageElement | null,
    pinchDist: 1,
    lastPinchDist: 1,
    shimmerActive: false,
    shimmerTime: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load Image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = LOGO_IMAGE_URL;
    img.onload = () => {
      stateRef.current.logoImage = img;
      initShards(img);
      setIsLoading(false);
    };

    // Initialize Ambient Elements
    initAmbient();

    // Animation Loop
    let animationFrame: number;
    const render = (time: number) => {
      update(time);
      draw(ctx);
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const initShards = (img: HTMLImageElement) => {
    const shards: Shard[] = [];
    const shardW = img.width / GRID_X;
    const shardH = img.height / GRID_Y;

    for (let y = 0; y < GRID_Y; y++) {
      for (let x = 0; x < GRID_X; x++) {
        const targetX = (x - GRID_X / 2) * shardW;
        const targetY = (y - GRID_Y / 2) * shardH;
        
        // Random off-screen initial position
        const angle = Math.random() * Math.PI * 2;
        const dist = 800 + Math.random() * 400;
        const initialX = Math.cos(angle) * dist;
        const initialY = Math.sin(angle) * dist;

        shards.push({
          x: initialX,
          y: initialY,
          targetX,
          targetY,
          initialX,
          initialY,
          u: x * shardW,
          v: y * shardH,
          w: shardW,
          h: shardH,
          rotation: Math.random() * Math.PI * 4,
          initialRotation: Math.random() * Math.PI * 4,
        });
      }
    }
    stateRef.current.shards = shards;
  };

  const initAmbient = () => {
    // Birds
    const birds: Bird[] = [];
    for (let i = 0; i < 5; i++) {
      birds.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.5,
        speed: 1 + Math.random() * 2,
        scale: 0.5 + Math.random() * 0.5,
        wingPhase: Math.random() * Math.PI * 2,
      });
    }
    stateRef.current.birds = birds;

    // Ambient Chars
    const ambientChars = [];
    for (let i = 0; i < 30; i++) {
      ambientChars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        char: HINDI_CHARS[Math.floor(Math.random() * HINDI_CHARS.length)],
        speed: 0.2 + Math.random() * 0.5,
        opacity: 0.1 + Math.random() * 0.3,
      });
    }
    stateRef.current.ambientChars = ambientChars;
  };

  const update = (time: number) => {
    const state = stateRef.current;
    
    // Smoothly interpolate pinch distance (Lerp)
    state.lastPinchDist = state.pinchDist;
    state.pinchDist += (pinchDistance - state.pinchDist) * 0.15;

    // Update Shards
    const p = 1 - state.pinchDist; // 0 = scattered, 1 = assembled
    const snapThreshold = 0.98;
    const isSnapped = p > snapThreshold;

    if (isSnapped && !isAssembled) {
      setIsAssembled(true);
      state.shimmerActive = true;
      state.shimmerTime = time;
    } else if (!isSnapped && isAssembled) {
      setIsAssembled(false);
    }

    state.shards.forEach(s => {
      const currentP = isSnapped ? 1 : p;
      s.x = s.initialX + (s.targetX - s.initialX) * currentP;
      s.y = s.initialY + (s.targetY - s.initialY) * currentP;
      s.rotation = s.initialRotation * (1 - currentP);
    });

    // Update Birds
    state.birds.forEach(b => {
      b.x += b.speed;
      if (b.x > window.innerWidth + 100) b.x = -100;
      b.wingPhase += 0.15;
    });

    // Update Ambient Chars
    state.ambientChars.forEach(c => {
      c.y -= c.speed;
      if (c.y < -50) c.y = window.innerHeight + 50;
    });

    // Update Particles (Fountain)
    if (isAssembled) {
      // Emit from book
      if (Math.random() > 0.7) {
        state.particles.push({
          x: window.innerWidth / 2 - 180, // Positioned near 'उ'
          y: window.innerHeight / 2 - 80,
          vx: (Math.random() - 0.5) * 2,
          vy: -2 - Math.random() * 3,
          char: HINDI_CHARS[Math.floor(Math.random() * HINDI_CHARS.length)],
          life: 1,
          size: 10 + Math.random() * 15,
        });
      }
    }

    state.particles = state.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.01;
      return p.life > 0;
    });
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const state = stateRef.current;
    const { width, height } = ctx.canvas;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    // Draw Ambient Chars
    ctx.font = '24px serif';
    state.ambientChars.forEach(c => {
      ctx.fillStyle = `rgba(0, 150, 255, ${c.opacity})`;
      ctx.fillText(c.char, c.x, c.y);
    });

    // Draw Birds
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    state.birds.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.scale, b.scale);
      const wingY = Math.sin(b.wingPhase) * 10;
      ctx.beginPath();
      ctx.moveTo(-20, wingY);
      ctx.lineTo(0, 0);
      ctx.lineTo(20, wingY);
      ctx.stroke();
      ctx.restore();
    });

    // Draw Shards
    if (state.logoImage) {
      const centerX = width / 2;
      const centerY = height / 2;
      
      state.shards.forEach(s => {
        ctx.save();
        ctx.translate(centerX + s.x, centerY + s.y);
        ctx.rotate(s.rotation);
        
        // Draw the shard
        ctx.drawImage(
          state.logoImage!,
          s.u, s.v, s.w, s.h,
          -s.w / 2, -s.h / 2, s.w, s.h
        );
        
        // Add a blue glow if assembling
        const p = 1 - state.pinchDist;
        if (p > 0.1 && p < 0.99) {
          ctx.strokeStyle = `rgba(0, 100, 255, ${p * 0.5})`;
          ctx.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
        }
        
        ctx.restore();
      });
    }

    // Draw Shimmer Effect
    if (state.shimmerActive) {
      const elapsed = performance.now() - state.shimmerTime;
      if (elapsed < 1000) {
        const opacity = 1 - elapsed / 1000;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
        ctx.fillRect(0, 0, width, height);
        
        // Sparkles
        for (let i = 0; i < 20; i++) {
          ctx.fillStyle = `rgba(0, 200, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(
            width / 2 + (Math.random() - 0.5) * 600,
            height / 2 + (Math.random() - 0.5) * 300,
            Math.random() * 3, 0, Math.PI * 2
          );
          ctx.fill();
        }
      } else {
        state.shimmerActive = false;
      }
    }

    // Draw Magical Book
    if (isAssembled) {
      drawBook(ctx, width / 2 - 180, height / 2 - 100);
    }

    // Draw Particles
    state.particles.forEach(p => {
      ctx.fillStyle = `rgba(0, 200, 255, ${p.life})`;
      ctx.font = `${p.size}px serif`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'cyan';
      ctx.fillText(p.char, p.x, p.y);
      ctx.shadowBlur = 0;
    });
  };

  const drawBook = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    // Book Cover (Leather Brown)
    ctx.fillStyle = '#4a2c1a';
    ctx.beginPath();
    ctx.roundRect(-40, -5, 80, 50, 5);
    ctx.fill();
    
    // Gold Edges
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(-40, -5, 80, 50);

    // Pages (Cream)
    ctx.fillStyle = '#f5f5dc';
    // Left Page
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-20, -10, -35, -5, -35, 35);
    ctx.lineTo(0, 40);
    ctx.closePath();
    ctx.fill();
    
    // Right Page
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(20, -10, 35, -5, 35, 35);
    ctx.lineTo(0, 40);
    ctx.closePath();
    ctx.fill();

    // Page Lines
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for(let i=1; i<5; i++) {
      ctx.beginPath();
      ctx.moveTo(-30, 5 + i*6);
      ctx.lineTo(-5, 5 + i*6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5, 5 + i*6);
      ctx.lineTo(30, 5 + i*6);
      ctx.stroke();
    }

    ctx.restore();
  };

  const startCamera = async () => {
    setIsCameraStarted(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        initHandTracking();
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setIsCameraStarted(false);
    }
  };

  const initHandTracking = async () => {
    // Load MediaPipe Hands from CDN for reliability in this environment
    const script1 = document.createElement('script');
    script1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
    const script2 = document.createElement('script');
    script2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
    
    document.head.appendChild(script1);
    document.head.appendChild(script2);

    script1.onload = () => {
      // @ts-ignore
      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          // Calculate pinch distance
          // We'll use the first hand's thumb (4) and index (8) tips
          const landmarks = results.multiHandLandmarks[0];
          const thumb = landmarks[4];
          const index = landmarks[8];
          
          const dx = thumb.x - index.x;
          const dy = thumb.y - index.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          // Map distance to 0-1 range
          // Typically pinch is < 0.05, open is > 0.2
          let normalized = (dist - 0.03) / (0.15 - 0.03);
          normalized = Math.max(0, Math.min(1, normalized));
          setPinchDistance(normalized);
        } else {
          // No hands detected, scatter
          setPinchDistance(1);
        }
      });

      // @ts-ignore
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480
      });
      camera.start();
    };
  };

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Hidden Video for Tracking */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        playsInline
      />

      {/* UI Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pointer-events-none">
        <AnimatePresence>
          {!isCameraStarted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center gap-8 pointer-events-auto"
            >
              <div className="text-center space-y-4">
                <h1 className="text-5xl font-light tracking-widest text-blue-400 uppercase">
                  Telekinesis
                </h1>
                <p className="text-blue-200/60 italic">The Magic of Flight</p>
              </div>
              
              <button
                onClick={startCamera}
                className="group relative px-8 py-4 bg-blue-600/20 border border-blue-500/50 rounded-full overflow-hidden transition-all hover:bg-blue-600/40 hover:border-blue-400"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="flex items-center gap-3 text-lg font-medium tracking-wide">
                  <Camera className="w-5 h-5" />
                  Request Camera Permissions
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isCameraStarted && !isAssembled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-20 flex flex-col items-center gap-4"
            >
              <motion.p
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-2xl font-light text-blue-400 tracking-widest uppercase"
              >
                Pinch to show the magic
              </motion.p>
              <div className="flex gap-4 opacity-30">
                <Hand className="w-6 h-6 animate-pulse" />
                <Sparkles className="w-6 h-6 animate-pulse delay-75" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isAssembled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-20 text-center"
          >
            <p className="text-blue-400/80 text-sm tracking-[0.3em] uppercase">
              Logo Assembled
            </p>
          </motion.div>
        )}
      </div>

      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-blue-400 animate-pulse tracking-widest text-xs uppercase">
                Preparing the magic...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner Branding */}
      <div className="absolute top-8 left-8 z-20 opacity-20 pointer-events-none">
        <p className="text-[10px] tracking-[0.5em] uppercase text-white">
          Udaan Experience
        </p>
      </div>
    </div>
  );
}
