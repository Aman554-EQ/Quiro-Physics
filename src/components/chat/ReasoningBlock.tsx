"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";

import { OrbitLoader } from "@/components/physics/indicators";
import { getTransition, spring } from "@/components/physics/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

/** Collapsible "Thinking" block — reasoning is shown separately from the answer, collapsed by default. */
export function ReasoningBlock({
  text,
  active,
  durationMs,
  defaultOpen = false,
}: {
  text: string;
  active: boolean;
  durationMs?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();
  const id = useId();
  const seconds = durationMs ? Math.max(1, Math.round(durationMs / 1000)) : null;

  return (
    <div className="mb-3" data-testid="reasoning-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="border-border text-muted hover:text-text inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13px]"
      >
        {active ? (
          <OrbitLoader className="size-5" label="Thinking" />
        ) : (
          <span aria-hidden className="bg-photon size-1.5 rounded-full" />
        )}
        <span>Thinking{seconds && !active ? ` · ${seconds} s` : active ? "…" : ""}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={getTransition(spring.soft, reduced)}
            className="overflow-hidden"
          >
            <p className="text-muted mt-2 border-l-2 border-[color-mix(in_oklch,var(--photon)_50%,transparent)] pl-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
              {text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
