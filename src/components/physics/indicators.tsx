import { cn } from "@/lib/cn";

/** "Thinking" indicator: two electrons orbiting a nucleus with a Kepler-like 1 : √8 period ratio. */
export function OrbitLoader({ className, label = "Thinking" }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("relative inline-grid size-8 place-items-center", className)}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border border-[color-mix(in_oklch,var(--field)_35%,transparent)]"
      />
      <span
        aria-hidden
        className="absolute inset-[22%] rounded-full border border-[color-mix(in_oklch,var(--photon)_35%,transparent)]"
      />
      <span aria-hidden className="bg-energy size-2 rounded-full shadow-[0_0_10px_var(--energy)]" />
      <span aria-hidden className="animate-orbit-slow absolute inset-0">
        <span className="bg-field absolute top-[-3px] left-1/2 size-[6px] -translate-x-1/2 rounded-full shadow-[0_0_8px_var(--field)]" />
      </span>
      <span aria-hidden className="animate-orbit absolute inset-[22%]">
        <span className="bg-photon absolute top-[-2.5px] left-1/2 size-[5px] -translate-x-1/2 rounded-full shadow-[0_0_8px_var(--photon)]" />
      </span>
    </span>
  );
}

/** Points along a Gaussian-envelope sine wave (a wave packet), as an SVG path string. */
export function wavePacketPath(width = 24, height = 8, cycles = 3, steps = 48): string {
  const mid = height / 2;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const u = (x - width / 2) / (width / 4);
    const envelope = Math.exp(-u * u);
    const y = mid - envelope * (height / 2 - 0.6) * Math.sin((i / steps) * cycles * 2 * Math.PI);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

const PACKET = wavePacketPath(36, 8, 4);

/** Streaming cursor: a tiny drifting wave packet at the end of the text. */
export function WavePacketCursor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-testid="wave-cursor"
      className={cn("ml-1 inline-block h-2 w-6 overflow-hidden align-middle", className)}
    >
      <svg viewBox="0 0 36 8" className="animate-wave h-2 w-9" preserveAspectRatio="none">
        <path d={PACKET} fill="none" stroke="var(--field)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export const PIPELINE_STAGES = [
  { id: "observe", label: "Observe", hint: "Understanding your question" },
  { id: "measure", label: "Measure", hint: "Searching your textbook" },
  { id: "derive", label: "Derive", hint: "Working out the answer" },
  { id: "verify", label: "Verify", hint: "Checking citations and maths" },
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number]["id"];

/** The answer pipeline as an experiment: Observe → Measure → Derive → Verify. */
export function PipelineStatus({
  stage,
  done = false,
  className,
  compact = false,
}: {
  stage: PipelineStage | null;
  done?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const activeIndex = stage ? PIPELINE_STAGES.findIndex((s) => s.id === stage) : -1;
  return (
    <ol
      aria-label="Answer progress"
      data-testid="pipeline-status"
      className={cn("flex items-center gap-1.5", className)}
    >
      {PIPELINE_STAGES.map((s, i) => {
        const state = done || i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
        return (
          <li
            key={s.id}
            data-stage={s.id}
            data-state={state}
            aria-current={state === "active" ? "step" : undefined}
            title={s.hint}
            className="flex items-center gap-1.5"
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-px w-4 transition-colors duration-500",
                  state === "pending" ? "bg-border" : "bg-field shadow-[0_0_6px_var(--field)]",
                )}
              />
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide transition-colors duration-300",
                state === "pending" && "border-border text-muted",
                state === "active" && "animate-pulse-node border-field text-field",
                state === "done" && "text-text border-[color-mix(in_oklch,var(--field)_40%,transparent)]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  state === "pending" ? "bg-border" : state === "active" ? "bg-field" : "bg-field/60",
                )}
              />
              {!compact || state === "active" ? s.label : <span className="sr-only">{s.label}</span>}
              <span className="sr-only">
                {state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
