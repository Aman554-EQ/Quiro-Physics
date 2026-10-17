"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

import {
  canvasScale,
  createParticles,
  LINK_DISTANCE,
  mulberry32,
  particleCount,
  step,
  type Particle,
} from "./particle-physics";

function readColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    field: s.getPropertyValue("--field").trim() || "oklch(0.8 0.13 210)",
    photon: s.getPropertyValue("--photon").trim() || "oklch(0.72 0.17 295)",
  };
}

/**
 * Ambient field of charged particles that drift away from the pointer.
 * Decorative only: aria-hidden, never focusable, never intercepts clicks.
 * Pauses when off-screen or the tab is hidden; draws a single static frame under reduced motion.
 */
export function ParticleField({ className, seed = 7 }: { className?: string; seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    let particles: Particle[] = [];
    let colors = readColors();
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let running = false;
    let visible = true;
    let last = 0;

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      const scale = canvasScale(window.devicePixelRatio || 1);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      particles = createParticles(particleCount(width), { width, height }, mulberry32(seed));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK_DISTANCE) {
            ctx.globalAlpha = (1 - d / LINK_DISTANCE) * 0.28;
            ctx.strokeStyle = colors.field;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = p.hue === "photon" ? colors.photon : colors.field;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const frame = (t: number) => {
      const dt = last ? Math.min(3, (t - last) / (1000 / 60)) : 1;
      last = t;
      step(particles, { width, height }, pointer, dt);
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    draw(); // one static frame always (and the only one under reduced motion)
    start();

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => (pointer = null);
    const onVisibility = () => (document.hidden ? stop() : start());
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const themeObserver = new MutationObserver(() => {
      colors = readColors();
      if (!running) draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced, seed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="particle-field"
      data-reduced={reduced}
      style={{ pointerEvents: "none" }}
      className={cn("absolute inset-0 h-full w-full", className)}
    />
  );
}
