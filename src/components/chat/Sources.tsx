"use client";

import { BookOpenText, X } from "lucide-react";

import { cn } from "@/lib/cn";
import type { Source } from "@/shared/ui-message";

export function pageLabel(s: Pick<Source, "pageStart" | "pageEnd">) {
  return s.pageStart === s.pageEnd ? `p.${s.pageStart}` : `pp.${s.pageStart}-${s.pageEnd}`;
}

/** Citation chips under an answer: "[1] p.71". */
export function SourcesChips({ sources, onOpen }: { sources: Source[]; onOpen: (label: number) => void }) {
  if (!sources.length) return null;
  return (
    <ul aria-label="Sources" className="mt-3 flex flex-wrap gap-2" data-testid="sources-chips">
      {sources.map((s) => (
        <li key={s.label}>
          <button
            type="button"
            onClick={() => onOpen(s.label)}
            aria-label={`Source ${s.label}: ${s.title}, ${pageLabel(s)}${s.deleted ? " (source deleted)" : ""}`}
            className={cn(
              "text-text inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color-mix(in_oklch,var(--field)_45%,transparent)] bg-[color-mix(in_oklch,var(--field)_10%,transparent)] px-3 text-[13px] transition-shadow hover:shadow-[0_0_14px_-2px_var(--field)]",
              s.deleted && "border-border bg-surface-2 text-muted",
            )}
          >
            <span className="text-field font-mono">[{s.label}]</span>
            <span>{pageLabel(s)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Evidence list: title, section, pages and the quoted passage. Highlights the selected citation. */
export function SourcesList({
  sources,
  selected,
  onClose,
}: {
  sources: Source[];
  selected: number | null;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col" data-testid="sources-list">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <BookOpenText className="text-field size-4" aria-hidden /> Sources
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sources"
            className="text-muted hover:text-text grid size-9 place-items-center rounded-md"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {sources.length === 0 ? (
        <p className="text-muted p-4 text-sm">
          When an answer uses your textbook, the exact passages and pages appear here.
        </p>
      ) : (
        <ol className="flex flex-col gap-3 overflow-y-auto p-4">
          {sources.map((s) => (
            <li
              key={s.label}
              data-source-label={s.label}
              aria-current={selected === s.label ? "true" : undefined}
              className={cn(
                "border-border bg-surface rounded-[var(--radius-sm)] border p-3 transition-shadow",
                selected === s.label &&
                  "border-field shadow-[0_0_0_1px_var(--field),0_0_24px_-8px_var(--field)]",
              )}
            >
              <p className="text-muted text-[13px]">
                <span className="text-field font-mono">[{s.label}]</span>{" "}
                {s.deleted ? "source deleted · " : ""}
                {pageLabel(s)}
              </p>
              <p className="mt-0.5 text-sm font-medium">{s.title}</p>
              {s.section && <p className="text-muted text-[13px]">{s.section}</p>}
              <blockquote className="border-field/60 text-text/90 mt-2 border-l-2 pl-3 text-[13.5px] leading-relaxed">
                “{s.quote}”
              </blockquote>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
