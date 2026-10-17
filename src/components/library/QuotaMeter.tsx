"use client";

import { cn } from "@/lib/cn";

export function formatSlot(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Meter({ label, value, used, limit, note, testId }: { label: string; value: string; used: number; limit: number; note: React.ReactNode; testId: string }) {
  const full = used >= limit;
  return (
    <div className="border-border bg-surface/70 rounded-[var(--radius-md)] border p-4" data-testid={testId}>
      <p className="text-muted text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <div
        className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", full ? "bg-energy" : "bg-field")}
          style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
        />
      </div>
      <p className="text-muted mt-2 text-xs">{note}</p>
    </div>
  );
}

/** "2 of 3 this week" and "4 of 5 active"; when the week is full, the exact next slot (P3-S2-A11). */
export function QuotaMeter({
  uploads,
  active,
}: {
  uploads: { used: number; limit: number; nextSlotAt: string | null };
  active: { used: number; limit: number };
}) {
  const weekFull = uploads.used >= uploads.limit;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Meter
        testId="quota-weekly"
        label="Uploads this week"
        value={`${uploads.used} of ${uploads.limit} this week`}
        used={uploads.used}
        limit={uploads.limit}
        note={
          weekFull && uploads.nextSlotAt ? (
            <span className="text-text">Next upload slot: {formatSlot(uploads.nextSlotAt)}</span>
          ) : (
            `${uploads.limit} uploads per rolling 7 days. Deleting a PDF doesn't give one back.`
          )
        }
      />
      <Meter
        testId="quota-active"
        label="Active PDFs"
        value={`${active.used} of ${active.limit} active`}
        used={active.used}
        limit={active.limit}
        note={active.used >= active.limit ? "Delete a PDF to add another." : "Delete a PDF to free a slot."}
      />
    </div>
  );
}
