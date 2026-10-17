import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

/**
 * Physics line illustrations (Newton's cradle, prism, magnet, circuit, apple, calculator, …).
 *
 * Plain SVG, safe in Server Components: no client JavaScript. Motion is pure CSS (`.ill-*`
 * classes in globals.css), so the global reduced-motion rules stop it automatically.
 * Strokes use `currentColor`; accents use the theme tokens, so both themes work.
 * Every illustration is decorative (`aria-hidden`); the surrounding text carries the meaning.
 */

type IllProps = { className?: string };

function Svg({
  viewBox,
  className,
  children,
}: {
  viewBox: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("ill", className)}
    >
      {children}
    </svg>
  );
}

/** Pivot for CSS rotations, in viewBox units (globals.css sets `transform-box: view-box`). */
const pivot = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });
const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/** Arrow from (x1,y1) to (x2,y2) with a drawn head. Coordinates are computed, so no <marker> ids are needed. */
function Arrow({
  x1,
  y1,
  x2,
  y2,
  color,
  head = 6,
  className,
  style,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  head?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = (t: number) => (x2 - head * Math.cos(a + t)).toFixed(1);
  const hy = (t: number) => (y2 - head * Math.sin(a + t)).toFixed(1);
  return (
    <g stroke={color} strokeWidth={2} className={className} style={style}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <path d={`M${hx(0.45)} ${hy(0.45)} L${x2} ${y2} L${hx(-0.45)} ${hy(-0.45)}`} />
    </g>
  );
}

function Label({
  x,
  y,
  children,
  size = 11,
  anchor = "middle",
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor={anchor}
      fill="currentColor"
      stroke="none"
      className="ill-label"
    >
      {children}
    </text>
  );
}

const SPECTRUM = ["var(--danger)", "var(--energy)", "oklch(0.78 0.17 135)", "var(--field)", "var(--photon)"];

/** Newton's cradle: the end balls trade momentum through the stationary middle three. */
export function NewtonsCradle({ className }: IllProps) {
  const xs = [44, 62, 80, 98, 116];
  return (
    <Svg viewBox="0 0 160 120" className={className}>
      <path d="M14 112 L22 10 H138 L146 112" />
      <path d="M6 112 H154" />
      {xs.map((x, i) => (
        <g
          key={x}
          className={i === 0 ? "ill-cradle-l" : i === xs.length - 1 ? "ill-cradle-r" : undefined}
          style={i === 0 || i === xs.length - 1 ? pivot(x, 10) : undefined}
        >
          <line x1={x} y1={10} x2={x} y2={78} strokeWidth={1.25} />
          <circle cx={x} cy={87} r={9} fill="var(--field)" fillOpacity={0.85} />
          <circle cx={x - 3} cy={84} r={2.2} fill="var(--surface)" fillOpacity={0.7} stroke="none" />
        </g>
      ))}
    </Svg>
  );
}

/** Simple pendulum with its amplitude arc. */
export function Pendulum({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <path d="M36 10 H84" />
      {[40, 48, 56, 64, 72, 80].map((x) => (
        <path key={x} d={`M${x} 10 l-5 -6`} strokeWidth={1.1} />
      ))}
      <path d="M60 10 V94" strokeDasharray="2 4" strokeWidth={1.1} opacity={0.6} />
      <path d="M33 86 A 78 78 0 0 0 87 86" strokeDasharray="3 4" strokeWidth={1.1} opacity={0.6} />
      <g className="ill-swing" style={pivot(60, 10)}>
        <line x1={60} y1={10} x2={60} y2={82} strokeWidth={1.4} />
        <circle cx={60} cy={92} r={10} fill="var(--energy)" fillOpacity={0.9} />
        <circle cx={56.5} cy={88.5} r={2.4} fill="var(--surface)" fillOpacity={0.7} stroke="none" />
      </g>
      <Label x={68} y={40} size={12}>
        <tspan fontStyle="italic">L</tspan>
      </Label>
    </Svg>
  );
}

/** Prism splitting white light into a spectrum. */
export function Prism({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 180 120" className={className}>
      <line x1={4} y1={73} x2={65} y2={57} stroke="var(--text)" strokeWidth={2.2} />
      <line
        x1={4}
        y1={73}
        x2={65}
        y2={57}
        stroke="var(--field)"
        strokeWidth={2.2}
        strokeDasharray="8 90"
        className="ill-flow-fast"
      />
      <line x1={65} y1={57} x2={115} y2={57} stroke="var(--text)" strokeWidth={1.4} opacity={0.6} />
      {SPECTRUM.map((c, i) => (
        <line
          key={c}
          x1={115}
          y1={57}
          x2={176}
          y2={62 + i * 9}
          stroke={c}
          strokeWidth={2.4}
          className="ill-glint"
          style={delay(i * 0.18)}
        />
      ))}
      <path d="M90 14 L140 100 H40 Z" fill="var(--field)" fillOpacity={0.12} strokeWidth={2} />
      <path d="M84 30 L92 44" stroke="var(--surface)" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

/** Horseshoe magnet with flowing field lines. */
export function Magnet({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 140 124" className={className}>
      <g strokeDasharray="3 5" strokeWidth={1.3} className="ill-flow" stroke="var(--photon)">
        <path d="M48 40 C48 22, 92 22, 92 40" />
        <path d="M42 40 C40 8, 100 8, 98 40" />
        <path d="M37 42 C24 -6, 116 -6, 103 42" />
      </g>
      <path
        d="M44 54 V84 A26 26 0 0 0 96 84 V54"
        strokeWidth={20}
        stroke="color-mix(in oklch, var(--muted) 45%, var(--surface))"
        strokeLinecap="butt"
      />
      <path d="M33 54 V84 A37 37 0 0 0 107 84 V54 M55 54 V84 A15 15 0 0 0 85 84 V54" strokeWidth={1.5} />
      <rect x={34} y={40} width={20} height={16} rx={2} fill="var(--danger)" strokeWidth={1.5} />
      <rect x={86} y={40} width={20} height={16} rx={2} fill="var(--field)" strokeWidth={1.5} />
      <Label x={44} y={52} size={10}>
        N
      </Label>
      <Label x={96} y={52} size={10}>
        S
      </Label>
    </Svg>
  );
}

const LOOP = "M20 56 V20 H70 l5 -7 l10 14 l10 -14 l10 14 l5 -7 H160 V48 M160 72 V100 H20 V64";

/** Battery, resistor and bulb in a loop. `open` draws a broken circuit (used by the error page). */
export function Circuit({ className, open = false }: IllProps & { open?: boolean }) {
  return (
    <Svg viewBox="0 0 180 120" className={className}>
      {open ? (
        <>
          <path d="M20 56 V20 H70 l5 -7 l10 14 l10 -14 l10 14 l5 -7 H118 M142 20 H160 V48 M160 72 V100 H20 V64" />
          <path d="M118 20 L138 6" strokeWidth={2} />
          <circle cx={118} cy={20} r={2} fill="currentColor" />
          <circle cx={142} cy={20} r={2} fill="currentColor" />
          <path
            d="M128 30 l4 6 l-5 2 l5 7"
            stroke="var(--energy)"
            strokeWidth={1.6}
            className="ill-flicker"
          />
        </>
      ) : (
        <>
          <path d={LOOP} />
          <path
            d={LOOP}
            stroke="var(--field)"
            strokeWidth={2.6}
            strokeDasharray="2 11"
            className="ill-flow-fast"
          />
          <circle cx={160} cy={60} r={19} fill="var(--energy)" stroke="none" className="ill-glow" />
        </>
      )}
      <path d="M8 56 H32" strokeWidth={2.2} />
      <path d="M14 64 H26" strokeWidth={4} />
      <Label x={38} y={54} size={11}>
        +
      </Label>
      <circle
        cx={160}
        cy={60}
        r={12}
        fill={open ? "var(--surface)" : "color-mix(in oklch, var(--energy) 35%, var(--surface))"}
      />
      <path d="M154 64 l3 -7 l3 7 l3 -7" strokeWidth={1.2} />
      <Label x={90} y={40} size={11}>
        <tspan fontStyle="italic">R</tspan>
      </Label>
    </Svg>
  );
}

/** Newton's apple with the gravitational field arrow. The apple drops a little on hover. */
export function Apple({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 100 124" className={className}>
      <g className="ill-apple">
        <g className="ill-sway" style={pivot(50, 18)}>
          <path
            d="M50 32 C40 22, 22 26, 22 46 C22 64, 36 76, 50 72 C64 76, 78 64, 78 46 C78 26, 60 22, 50 32 Z"
            fill="var(--danger)"
            fillOpacity={0.85}
          />
          <path d="M36 40 C33 44, 32 49, 33 54" stroke="var(--surface)" strokeWidth={2} opacity={0.6} />
          <path d="M50 32 C50 26, 52 21, 55 17" />
          <path d="M53 23 C58 14, 68 13, 72 17 C66 24, 58 25, 53 23 Z" fill="oklch(0.72 0.15 140)" />
        </g>
      </g>
      <g strokeDasharray="3 5" className="ill-flow-down">
        <path d="M50 84 V114" />
      </g>
      <Arrow x1={50} y1={108} x2={50} y2={118} color="currentColor" head={5} />
      <Label x={62} y={106} size={13}>
        <tspan fontStyle="italic">g</tspan>
      </Label>
    </Svg>
  );
}

/** Scientific calculator showing g. Keys light up one after another. */
export function Calculator({ className }: IllProps) {
  const keys: { x: number; y: number; i: number }[] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) keys.push({ x: 24 + c * 14, y: 52 + r * 14, i: r * 4 + c });
  const lit = new Set([2, 7, 9, 12]);
  return (
    <Svg viewBox="0 0 100 120" className={className}>
      <rect x={14} y={8} width={72} height={106} rx={10} fill="var(--surface)" strokeWidth={2} />
      <rect x={24} y={18} width={52} height={24} rx={4} fill="var(--field)" fillOpacity={0.16} />
      <text
        x={71}
        y={35}
        fontSize={12}
        textAnchor="end"
        fill="currentColor"
        stroke="none"
        className="ill-digits"
      >
        9.81
      </text>
      {keys.map((k) => (
        <rect
          key={k.i}
          x={k.x}
          y={k.y}
          width={10}
          height={9}
          rx={2}
          strokeWidth={1.2}
          fill={k.i === 15 ? "var(--field)" : "transparent"}
          className={lit.has(k.i) ? "ill-key" : undefined}
          style={lit.has(k.i) ? delay([...lit].indexOf(k.i) * 0.6) : undefined}
        />
      ))}
    </Svg>
  );
}

/** Free-body diagram: block on an incline with weight, normal force and friction. */
export function ForceDiagram({ className }: IllProps) {
  // Slope angle ≈ 25.9°; block resting at (80, 72); arrows start at the block's centre.
  const cx = 75.6;
  const cy = 63;
  return (
    <Svg viewBox="0 0 160 120" className={className}>
      <path d="M14 104 H146 V40 Z" fill="var(--surface-2)" fillOpacity={0.6} />
      <path d="M38 104 A 24 24 0 0 0 36 93" strokeWidth={1.2} />
      <Label x={46} y={100} size={10}>
        <tspan fontStyle="italic">θ</tspan>
      </Label>
      <rect
        x={65}
        y={52}
        width={30}
        height={20}
        rx={2}
        fill="var(--field)"
        fillOpacity={0.25}
        transform="rotate(-25.9 80 72)"
      />
      <Arrow x1={cx} y1={cy} x2={cx} y2={104} color="var(--energy)" className="ill-pulse" />
      <Arrow x1={cx} y1={cy} x2={61} y2={33} color="var(--field)" className="ill-pulse" style={delay(0.5)} />
      <Arrow x1={cx} y1={cy} x2={103} y2={50} color="var(--photon)" className="ill-pulse" style={delay(1)} />
      <Label x={66} y={100} size={10}>
        <tspan fontStyle="italic">mg</tspan>
      </Label>
      <Label x={52} y={34} size={10}>
        <tspan fontStyle="italic">N</tspan>
      </Label>
      <Label x={110} y={50} size={10}>
        <tspan fontStyle="italic">f</tspan>
      </Label>
    </Svg>
  );
}

/** Liquid-in-glass thermometer; the column rises and falls. */
export function Thermometer({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 70 120" className={className}>
      <path d="M29 92 V16 A6 6 0 0 1 41 16 V92" fill="var(--surface)" />
      <rect
        x={32}
        y={36}
        width={6}
        height={60}
        rx={3}
        fill="var(--danger)"
        stroke="none"
        className="ill-rise"
        style={pivot(35, 96)}
      />
      <circle cx={35} cy={100} r={11} fill="var(--danger)" />
      {[24, 36, 48, 60, 72, 84].map((y, i) => (
        <path key={y} d={`M45 ${y} H${i % 2 ? 50 : 53}`} strokeWidth={1.2} />
      ))}
    </Svg>
  );
}

/** Bohr-style atom: nucleus with three precessing orbits. */
export function Atom({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      {[0, 60, 120].map((deg, i) => (
        <g key={deg} transform={`rotate(${deg} 60 60)`}>
          <g className="ill-spin" style={{ ...pivot(60, 60), animationDuration: `${6 + i * 2.5}s` }}>
            <ellipse cx={60} cy={60} rx={48} ry={17} strokeWidth={1.4} />
            <circle cx={108} cy={60} r={4} fill="var(--photon)" stroke="none" />
          </g>
        </g>
      ))}
      <circle cx={56} cy={57} r={6} fill="var(--field)" />
      <circle cx={64} cy={57} r={6} fill="var(--energy)" />
      <circle cx={60} cy={64} r={6} fill="var(--field)" />
    </Svg>
  );
}

/** Open textbook; a highlight sweeps across a line like a citation being found. */
export function Textbook({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 160 120" className={className}>
      <path d="M80 30 C62 20, 32 20, 14 26 V102 C32 96, 62 96, 80 106 Z" fill="var(--surface)" />
      <path d="M80 30 C98 20, 128 20, 146 26 V102 C128 96, 98 96, 80 106 Z" fill="var(--surface)" />
      <path d="M80 30 V106" />
      <rect
        x={98}
        y={56}
        width={36}
        height={8}
        rx={2}
        fill="var(--energy)"
        fillOpacity={0.4}
        stroke="none"
        className="ill-highlight"
        style={pivot(98, 60)}
      />
      {[42, 52, 62, 72, 82].map((y, i) => (
        <path key={`l${y}`} d={`M26 ${y} H${i === 2 ? 52 : 68}`} strokeWidth={1.2} opacity={0.6} />
      ))}
      <text x={56} y={66} fontSize={9} fill="currentColor" stroke="none" className="ill-label">
        <tspan fontStyle="italic">F</tspan>=<tspan fontStyle="italic">ma</tspan>
      </text>
      {[42, 50, 60, 70, 80].map((y, i) => (
        <path
          key={`r${y}`}
          d={`M92 ${y} H${i === 2 ? 134 : 136}`}
          strokeWidth={1.2}
          opacity={i === 2 ? 0 : 0.6}
        />
      ))}
      <path d="M126 22 V40 l5 -4 l5 4 V21" fill="var(--field)" strokeWidth={1.3} />
    </Svg>
  );
}

/** Chalkboard with E = mc², the underline is drawn in chalk. */
export function Chalkboard({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 160 112" className={className}>
      <rect x={8} y={8} width={144} height={84} rx={6} fill="oklch(0.36 0.05 165)" strokeWidth={3} />
      <text
        x={80}
        y={56}
        fontSize={24}
        textAnchor="middle"
        fill="oklch(0.96 0.01 120)"
        stroke="none"
        className="ill-label"
      >
        <tspan fontStyle="italic">E</tspan> = <tspan fontStyle="italic">mc</tspan>
        <tspan dy={-10} fontSize={14}>
          2
        </tspan>
      </text>
      <path
        d="M44 68 C70 64, 96 66, 118 64"
        stroke="oklch(0.96 0.01 120)"
        strokeWidth={2}
        strokeDasharray="80"
        className="ill-draw"
      />
      <path d="M22 100 H138" strokeWidth={2.2} />
      <rect x={110} y={94} width={14} height={4} rx={1.5} fill="oklch(0.96 0.01 120)" stroke="none" />
    </Svg>
  );
}

/** Projectile: a ball following a parabola (horizontal linear motion × vertical ease = parabola). */
export function Projectile({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 180 110" className={className}>
      <path d="M6 96 H174" />
      <path d="M16 96 Q90 -20 164 96" strokeDasharray="2 5" strokeWidth={1.3} opacity={0.7} />
      <Arrow x1={16} y1={96} x2={38} y2={66} color="var(--photon)" />
      <Label x={44} y={64} size={11}>
        <tspan fontStyle="italic">v</tspan>
        <tspan dy={3} fontSize={8}>
          0
        </tspan>
      </Label>
      <g className="ill-proj-x">
        <g className="ill-proj-y">
          <circle cx={16} cy={96} r={5.5} fill="var(--energy)" />
        </g>
      </g>
    </Svg>
  );
}

/** Travelling sine wave. */
export function Wave({ className }: IllProps) {
  return (
    <Svg viewBox="0 0 160 80" className={className}>
      <path d="M4 40 H156" strokeWidth={1} opacity={0.5} />
      <path
        d="M4 40 C14 10, 24 10, 34 40 S54 70, 64 40 S84 10, 94 40 S114 70, 124 40 S144 10, 154 40"
        stroke="var(--field)"
        strokeWidth={2.2}
        strokeDasharray="6 4"
        className="ill-flow"
      />
      <path d="M19 18 V40" strokeDasharray="2 3" strokeWidth={1} />
      <Label x={24} y={14} size={11}>
        <tspan fontStyle="italic">A</tspan>
      </Label>
    </Svg>
  );
}

/** Brand mark: the "Q" is an orbit around a nucleus, and its tail is a pendulum with its bob. */
export function BrandMark({ className, animated = false }: IllProps & { animated?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden focusable="false" className={cn("ill size-7 shrink-0", className)}>
      <circle cx={15} cy={15} r={10.5} fill="none" stroke="var(--field)" strokeWidth={2.2} />
      <path d="M22.2 22.2 L26.6 26.6" stroke="var(--field)" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={27.4} cy={27.4} r={2.8} fill="var(--energy)" />
      <circle cx={15} cy={15} r={2.6} fill="var(--text)" />
      <g className={animated ? "ill-spin" : undefined} style={{ ...pivot(15, 15), animationDuration: "9s" }}>
        <circle cx={15} cy={4.5} r={2.1} fill="var(--photon)" />
      </g>
    </svg>
  );
}
