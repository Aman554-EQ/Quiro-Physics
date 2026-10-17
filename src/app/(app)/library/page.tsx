import type { Metadata } from "next";

import { Textbook } from "@/components/physics/illustrations";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Library" };

function Meter({ label, used, limit, note }: { label: string; used: number; limit: number; note: string }) {
  return (
    <div className="border-border bg-surface/70 rounded-[var(--radius-md)] border p-4">
      <p className="text-muted text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {used} <span className="text-muted text-base font-normal">of {limit}</span>
      </p>
      <div
        className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div className="bg-field h-full rounded-full" style={{ width: `${(used / limit) * 100}%` }} />
      </div>
      <p className="text-muted mt-2 text-xs">{note}</p>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <PageBody>
      <PageHeader
        title="Library"
        description="Upload your physics textbooks as PDFs so that answers can cite the exact pages."
        art={<Textbook />}
      />
      <p className="border-border bg-surface/60 text-muted mt-6 rounded-[var(--radius-md)] border border-dashed p-4 text-[15px]">
        PDF uploads open in the next build phase. Your quotas are shown below so you know what to expect.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Meter label="Uploads this week" used={0} limit={3} note="3 uploads per rolling 7 days." />
        <Meter label="Active PDFs" used={0} limit={5} note="Delete a PDF to free a slot." />
      </div>
      <div
        aria-disabled
        className="border-border bg-surface/40 mt-6 flex min-h-48 flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed p-8 text-center"
      >
        <Textbook className="h-16 w-auto" />
        <p className="text-[15px]">Drop a PDF here, or tap to choose one</p>
        <p className="text-muted text-sm">
          PDF only · up to 10 MB · up to 300 pages · coming in the next build phase
        </p>
      </div>
    </PageBody>
  );
}
