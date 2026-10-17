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

    // Batched drawing: links grouped into a few opacity levels and particles by colour, so each
    // frame is a handful of stroke()/fill() calls instead of one per line (colour strings are
    // parsed once per batch, not once per line). It was the largest main-thread cost on phones.
    const LEVELS = 4;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = colors.field;
      const buckets: number[][] = Array.from({ length: LEVELS }, () => []);
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK_DISTANCE) buckets[Math.min(LEVELS - 1, Math.floor((1 - d / LINK_DISTANCE) * LEVELS))]!.push(a.x, a.y, b.x, b.y);
        }
      }
      buckets.forEach((seg, level) => {
        if (!seg.length) return;
        ctx.globalAlpha = ((level + 0.5) / LEVELS) * 0.28;
        ctx.beginPath();
        for (let k = 0; k < seg.length; k += 4) {
          ctx.moveTo(seg[k]!, seg[k + 1]!);
          ctx.lineTo(seg[k + 2]!, seg[k + 3]!);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 0.85;
      for (const hue of ["field", "photon"] as const) {
        ctx.fillStyle = colors[hue];
        ctx.beginPath();
        for (const p of particles) {
          if (p.hue !== hue) continue;
          ctx.moveTo(p.x + p.r, p.y);
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // Decoration: 30 frames a second is smooth enough and halves the work.
    const FRAME_MS = 1000 / 30;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (last && t - last < FRAME_MS - 1) return;
      const dt = last ? Math.min(3, (t - last) / (1000 / 60)) : 1;
      last = t;
      step(particles, { width, height }, pointer, dt);
      draw();
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
