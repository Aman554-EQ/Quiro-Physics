"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";

/** Display equation container: scrolls sideways on narrow screens, copies its LaTeX source. */
export function EquationCard({
  latex,
  children,
  className,
}: {
  latex: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      toast.success("LaTeX copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };
  return (
    <figure
      role="group"
      aria-label="Equation"
      data-testid="equation-card"
      data-latex={latex}
      className={cn(
        "group/eq border-border relative my-3 rounded-[var(--radius-sm)] border bg-[color-mix(in_oklch,var(--surface-2)_65%,transparent)] py-3 pr-11 pl-4",
        className,
      )}
    >
      <div
        data-testid="equation-scroll"
        className="overflow-x-auto overflow-y-hidden"
        style={{ overflowX: "auto" }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy LaTeX"
        title="Copy LaTeX"
        className="text-muted hover:bg-surface hover:text-text absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-md opacity-70 transition-opacity group-hover/eq:opacity-100 focus-visible:opacity-100"
      >
        {copied ? (
          <Check className="text-field size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </button>
    </figure>
  );
}

/** Shown instead of KaTeX's red error text when an equation can't be rendered. */
export function MathFallback({ latex }: { latex: string }) {
  return (
    <code
      data-testid="math-fallback"
      title="Couldn't render this equation"
      className="bg-surface-2 text-muted rounded-md border border-dashed border-[color-mix(in_oklch,var(--energy)_55%,transparent)] px-1.5 py-0.5 font-mono text-[0.88em]"
    >
      {latex}
    </code>
  );
}

export function EquationForming() {
  return (
    <div
      data-testid="equation-forming"
      aria-label="Equation forming"
      className="border-border text-muted my-3 flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-dashed px-4 text-sm"
    >
      <span className="bg-field size-1.5 animate-pulse rounded-full" aria-hidden />
      equation forming…
    </div>
  );
}
