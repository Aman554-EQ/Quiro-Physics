"use client";

import { useEffect, useRef, useState } from "react";

import { PIPELINE_STAGES, PipelineStatus, type PipelineStage } from "@/components/physics/indicators";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const DETAIL: Record<PipelineStage, string> = {
  observe: "Reads the question, resolves follow-ups and confirms that it is about physics.",
  measure: "Searches your textbook by meaning and by exact terms, limited to your own PDFs.",
  derive: "Writes the answer as it thinks: the intuition, the equations and the working, line by line.",
  verify: "Keeps only citations to pages it actually retrieved and checks that every equation renders.",
};

/** Animated "experiment pipeline". Cycles only while visible; static under reduced motion. */
export function HowItWorks() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reduced || !ref.current) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !timer)
        timer = setInterval(() => setIndex((i) => (i + 1) % PIPELINE_STAGES.length), 1800);
      else if (!entry?.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    io.observe(ref.current);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [reduced]);

  const stage = PIPELINE_STAGES[index]!;
  return (
    <section ref={ref} aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-field text-sm font-medium">Method</p>
        <h2 id="how-title" className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold">
          How an answer is put together
        </h2>
        <p className="text-muted mt-3 text-[17px]">
          The same four stages as an experiment, run for every question you ask.
        </p>
      </div>
      <div className="mt-10 flex overflow-x-auto pb-2">
        <PipelineStatus stage={reduced ? null : stage.id} done={reduced} />
      </div>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE_STAGES.map((s, i) => (
          <li
            key={s.id}
            className="border-border bg-surface/70 rounded-[var(--radius-md)] border p-5 transition-shadow duration-500 data-[active=true]:border-[color-mix(in_oklch,var(--field)_55%,transparent)] data-[active=true]:shadow-[0_0_0_1px_var(--field),0_12px_40px_-18px_var(--field)]"
            data-active={!reduced && i === index}
          >
            <p className="text-field text-xs font-semibold tabular-nums">0{i + 1}</p>
            <h3 className="mt-1 text-xl font-semibold">{s.label}</h3>
            <p className="text-muted mt-1 text-[15px]">{DETAIL[s.id]}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
