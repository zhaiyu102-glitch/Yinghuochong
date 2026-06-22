import React, { useEffect, useRef } from "react";

interface Raindrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  weight: number;
  opacity: number;
}

interface Splash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
}

interface RainCanvasProps {
  isRaining: boolean;
}

export default function RainCanvas({ isRaining }: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRainingRef = useRef(isRaining);

  // Sync ref to avoid stale closure in animation loop
  useEffect(() => {
    isRainingRef.current = isRaining;
  }, [isRaining]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Raindrops list
    const raindrops: Raindrop[] = [];
    const maxRaindrops = 140;

    // Splashes list
    const splashes: Splash[] = [];

    // Water level accumulation tracking
    let puddleHeight = 0;

    // Initialize raindrops
    for (let i = 0; i < maxRaindrops; i++) {
      raindrops.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        length: 10 + Math.random() * 25,
        speed: 8 + Math.random() * 12,
        weight: 1 + Math.random() * 1.5,
        opacity: 0.15 + Math.random() * 0.4,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Wind drift angle (slight slant)
    const windAngle = 0.12; // angle in radians

    const updateAndDraw = () => {
      // Check if rain has stopped - freeze all frame renders and animations instantly!
      if (!isRainingRef.current) {
        // Stop requesting further frames to halt/freeze the entire canvas animation completely as requested!
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Drifts background gradient slightly for extra cozy ambiance
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "rgba(2, 6, 12, 0.4)");
      grad.addColorStop(1, "rgba(1, 3, 6, 0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw and update accumulated water level (积水层)
      puddleHeight = Math.min(38, puddleHeight + 0.14); // Grow puddle naturally over the 5 seconds
      if (puddleHeight > 0) {
        ctx.save();
        // Glassy cyan/dark water accumulation layer at bottom
        ctx.fillStyle = "rgba(8, 47, 73, 0.45)"; // Deep watery layer
        ctx.fillRect(0, height - puddleHeight, width, puddleHeight);

        // Glowing wave crest reflections
        ctx.beginPath();
        ctx.strokeStyle = "rgba(165, 243, 252, 0.65)"; // Neon cyan highlight wave
        ctx.lineWidth = 1.5;
        const waveTime = Date.now() * 0.004;
        ctx.moveTo(0, height - puddleHeight);
        for (let x = 0; x <= width; x += 15) {
          const waveY = Math.sin(x * 0.015 + waveTime) * 2.2;
          ctx.lineTo(x, height - puddleHeight + waveY);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw and update Raindrops
      for (let i = 0; i < raindrops.length; i++) {
        const drop = raindrops[i];

        // Move
        drop.y += drop.speed;
        drop.x += Math.sin(windAngle) * drop.speed;

        // Draw raindrop streak
        ctx.beginPath();
        const endX = drop.x + Math.sin(windAngle) * drop.length;
        const endY = drop.y + drop.length;

        // Soft neon glowing blue/teal rain drops
        ctx.strokeStyle = `rgba(186, 230, 253, ${drop.opacity})`;
        ctx.lineWidth = drop.weight;
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // If raindrop hits the rising puddle or floor, spawn splash ripple animations
        const collisionHeight = height - puddleHeight;
        if (drop.y > collisionHeight && Math.random() > 0.85) {
          splashes.push({
            x: drop.x,
            y: collisionHeight + Math.random() * puddleHeight,
            radius: 1,
            maxRadius: 6 + Math.random() * 8,
            opacity: drop.opacity * 0.7,
            speed: 0.4 + Math.random() * 0.6,
          });
        }

        // Reset drop to the top if it reaches offscreen bounds
        if (drop.y > height || drop.x > width + 50 || drop.x < -50) {
          drop.y = -30;
          drop.x = Math.random() * width;
          drop.speed = 8 + Math.random() * 12;
          drop.opacity = 0.15 + Math.random() * 0.4;
        }
      }

      // Draw and update ripples/splashes on hitting ground or floating transparently
      for (let i = splashes.length - 1; i >= 0; i--) {
        const splash = splashes[i];
        splash.radius += splash.speed;
        splash.opacity -= 0.02;

        if (splash.opacity <= 0 || splash.radius >= splash.maxRadius) {
          splashes.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.strokeStyle = `rgba(165, 243, 252, ${splash.opacity})`;
        ctx.lineWidth = 0.8;
        // Draw an oval ripple
        ctx.ellipse(
          splash.x,
          splash.y,
          splash.radius * 1.5,
          splash.radius * 0.4,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block pointer-events-none z-0"
    />
  );
}
