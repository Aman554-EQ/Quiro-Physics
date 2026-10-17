import { Circuit, Magnet, NewtonsCradle, Prism } from "@/components/physics/illustrations";

const FIGURES = [
  { Ill: NewtonsCradle, caption: "Conservation of momentum", eq: "p = mv" },
  { Ill: Prism, caption: "Dispersion of light", eq: "n₁ sin θ₁ = n₂ sin θ₂" },
  { Ill: Circuit, caption: "Ohm's law", eq: "V = IR" },
  { Ill: Magnet, caption: "Magnetic field", eq: "F = qv × B" },
];

/** Hero "lab notebook": four animated figures on graph paper. Decorative, server-rendered, no JavaScript. */
export function LabBench() {
  return (
    <div
      aria-hidden
      data-testid="lab-bench"
      className="graph-paper border-border bg-surface/70 shadow-glow grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border backdrop-blur-sm"
    >
      {FIGURES.map(({ Ill, caption, eq }, i) => (
        <figure
          key={caption}
          className="group border-border hover:bg-surface/60 flex flex-col justify-between gap-2 p-3 transition-colors sm:p-5 [&:nth-child(-n+2)]:border-b [&:nth-child(odd)]:border-r"
        >
          <Ill className="h-auto max-h-36 w-full" />
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] sm:text-xs">
            <span className="text-muted">
              <span className="text-text/80 font-medium">Fig. {i + 1}</span> {caption}
            </span>
            <span className="font-display text-text/80 hidden text-[13px] italic sm:inline">{eq}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
