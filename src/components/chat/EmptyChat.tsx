"use client";

import { motion } from "motion/react";

import { getTransition, spring } from "@/components/physics/motion";
import { NewtonsCradle } from "@/components/physics/illustrations";
import { SAMPLE_ART } from "@/components/physics/topic-art";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SAMPLE_QUESTIONS } from "@/lib/sample-questions";

/** Empty state: what the tutor does + sample questions that fill the composer. */
export function EmptyChat({ onPick }: { onPick: (q: string) => void }) {
  const reduced = useReducedMotion();
  return (
    <div className="mx-auto flex min-h-full max-w-[720px] flex-col items-center justify-center-safe gap-4 py-2 text-center sm:gap-6 sm:py-6">
      <NewtonsCradle className="h-14 w-auto sm:h-24" />
      <div>
        <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-semibold">What would you like to understand?</h2>
        <p className="text-muted mt-2">
          Concepts, derivations and worked problems, with every equation typeset as in a textbook.
        </p>
      </div>
      <ul className="grid w-full gap-3 sm:grid-cols-2" aria-label="Sample questions">
        {SAMPLE_QUESTIONS.map((s, i) => {
          const Ill = SAMPLE_ART[s.topic];
          return (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...getTransition(spring.soft, reduced), delay: reduced ? 0 : 0.05 * i }}
            >
              <button
                type="button"
                onClick={() => onPick(s.question)}
                className="group border-border bg-surface flex h-full min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-[border-color,box-shadow] hover:border-[color-mix(in_oklch,var(--field)_55%,transparent)] hover:shadow-[0_12px_40px_-24px_var(--field)]"
              >
                <Ill className="hidden h-11 w-14 shrink-0 sm:block" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-field text-xs font-medium">{s.topic}</span>
                  <span className="text-[15px]">{s.question}</span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
      <p className="text-muted text-xs">
        Free to use · Step-by-step answers with equations, units and diagrams
      </p>
    </div>
  );
}
