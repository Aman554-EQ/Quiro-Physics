/**
 * Pure physics for the ambient particle field (no DOM): charged particles repelled by the
 * pointer with an inverse-square force, damped back towards a gentle thermal drift.
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Thermal drift velocity the particle relaxes towards */
  bx: number;
  by: number;
  r: number;
  hue: "field" | "photon";
}

export interface Bounds {
  width: number;
  height: number;
}

export const MOBILE_BREAKPOINT = 640;
export const MAX_PARTICLES_MOBILE = 40;
export const MAX_PARTICLES_DESKTOP = 90;
export const DAMPING = 0.96;
export const FORCE_CONSTANT = 600; // px³/frame² — tuned by eye
export const MAX_FORCE = 8;
export const INFLUENCE_RADIUS = 160;
export const LINK_DISTANCE = 110;
export const MAX_DPR = 2;

export function particleCount(width: number): number {
  if (width < MOBILE_BREAKPOINT) return Math.min(MAX_PARTICLES_MOBILE, Math.max(18, Math.round(width / 12)));
  return Math.min(MAX_PARTICLES_DESKTOP, Math.round(width / 18));
}

/** Inverse-square repulsion magnitude, clamped so r → 0 never produces Infinity/NaN. */
export function repulsion(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return MAX_FORCE;
  return Math.min(MAX_FORCE, FORCE_CONSTANT / (r * r));
}

export function canvasScale(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(devicePixelRatio, MAX_DPR);
}

/** Deterministic PRNG so tests (and SSR snapshots) are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createParticles(
  count: number,
  bounds: Bounds,
  random: () => number = Math.random,
): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = random() * Math.PI * 2;
    const speed = 0.08 + random() * 0.22;
    return {
      x: random() * bounds.width,
      y: random() * bounds.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      bx: Math.cos(angle) * speed,
      by: Math.sin(angle) * speed,
      r: 0.8 + random() * 1.8,
      hue: i % 5 === 0 ? "photon" : "field",
    };
  });
}

/**
 * Advance one frame (dt in frames, 1 = 1/60 s). Mutates and returns the array.
 * v ← (v + F) · damping + drift · (1 − damping), then wrap around the edges.
 */
export function step(
  particles: Particle[],
  bounds: Bounds,
  pointer: { x: number; y: number } | null,
  dt = 1,
): Particle[] {
  const damp = Math.pow(DAMPING, dt);
  for (const p of particles) {
    if (pointer) {
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < INFLUENCE_RADIUS) {
        const f = repulsion(dist) * dt;
        const nx = dist === 0 ? 1 : dx / dist;
        const ny = dist === 0 ? 0 : dy / dist;
        p.vx += nx * f;
        p.vy += ny * f;
      }
    }
    p.vx = p.vx * damp + p.bx * (1 - damp);
    p.vy = p.vy * damp + p.by * (1 - damp);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 0) p.x += bounds.width;
    else if (p.x > bounds.width) p.x -= bounds.width;
    if (p.y < 0) p.y += bounds.height;
    else if (p.y > bounds.height) p.y -= bounds.height;
  }
  return particles;
}

export function speed(p: Pick<Particle, "vx" | "vy">) {
  return Math.hypot(p.vx, p.vy);
}
