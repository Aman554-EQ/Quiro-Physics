"use client";

import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { formatBytes, type DocumentSummary } from "@/shared/documents";

export interface CardDocument extends DocumentSummary {
  /** Client-only: bytes are still going up (0–1). */
  uploading?: number;
  /** Client-only: when this status arrived (epoch ms), for the live countdown. */
  receivedAt?: number;
}

const LABEL: Record<DocumentSummary["status"], string> = {
  reserved: "Uploading",
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
  deleting: "Deleting",
};

/** "Less than a minute left", "About 3 min left", "About 2 h left". */
export function formatEta(seconds: number) {
  if (seconds < 45) return "Less than a minute left";
  if (seconds < 90) return "About 1 min left";
  if (seconds < 3_600) return `About ${Math.round(seconds / 60)} min left`;
  return `About ${Math.round(seconds / 3_600)} h left`;
}

/**
 * Seconds left, counting down every second between status polls so the estimate feels live
 * (each poll brings the server's figure and the time it arrived).
 */
function useCountdown(seconds: number | null | undefined, receivedAt: number | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [active]);
  if (seconds == null) return null;
  return Math.max(1, seconds - Math.max(0, now - (receivedAt ?? now)) / 1_000);
}

const pauseTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** One PDF: status, progress, problems and the actions that make sense for its status (P3-S2-A13). */
export function DocumentCard({ doc, onDelete }: { doc: CardDocument; onDelete: (doc: CardDocument) => void }) {
  const busy = doc.status === "reserved" || doc.status === "queued" || doc.status === "processing";
  const left = useCountdown(doc.progress?.etaSeconds, doc.receivedAt, busy && doc.uploading === undefined);
  const timing = doc.progress?.pausedUntil
    ? `Continues automatically at ${pauseTime(doc.progress.pausedUntil)}`
    : left !== null && busy && doc.uploading === undefined
      ? formatEta(left)
      : null;
  const fraction = doc.uploading ?? doc.progress?.fraction ?? (doc.status === "queued" ? 0 : null);
  const detail =
    doc.uploading !== undefined
      ? `Uploading ${Math.round(doc.uploading * 100)}%`
      : doc.status === "processing"
        ? (doc.progress?.label ?? "Processing")
        : doc.status === "queued"
          ? "Waiting to start"
          : doc.status === "ready"
            ? [
                doc.pageCount ? `${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}` : null,
                `${doc.chunkCount} ${doc.chunkCount === 1 ? "passage" : "passages"}`,
                formatBytes(doc.sizeBytes),
              ]
                .filter(Boolean)
                .join(" · ")
            : null;

  return (
    <li
      data-testid="document-card"
      data-status={doc.uploading !== undefined ? "uploading" : doc.status}
      className="border-border bg-surface/70 flex gap-3 rounded-[var(--radius-md)] border p-4"
    >
      <div className="bg-surface-2 text-field grid size-10 shrink-0 place-items-center rounded-md">
        <FileText className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium" title={doc.originalFilename}>
            {doc.title}
          </p>
          <span
            data-testid="document-status"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]",
              doc.status === "ready" && "bg-[color-mix(in_oklch,var(--field)_14%,transparent)] text-field",
              doc.status === "failed" && "bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-danger",
              busy && "bg-surface-2 text-muted",
            )}
          >
            {busy && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />}
            {doc.status === "ready" && <CheckCircle2 className="size-3" aria-hidden />}
            {doc.uploading !== undefined ? "Uploading" : LABEL[doc.status]}
          </span>
        </div>
        {detail && (
          <p className="text-muted mt-0.5 text-[13px]" data-testid="document-detail">
            {detail}
            {doc.status === "processing" && doc.pageCount && doc.progress?.stage !== "extract" ? ` · ${doc.pageCount} pages read` : ""}
          </p>
        )}
        {timing && (
          <p className="text-muted mt-0.5 flex items-center gap-1.5 text-[13px]" data-testid="document-eta" aria-live="polite">
            <Clock className="size-3.5 shrink-0" aria-hidden /> {timing}
          </p>
        )}
        {busy && fraction !== null && (
          <div
            className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={`${doc.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fraction * 100)}
          >
            <div className="bg-field h-full rounded-full transition-[width]" style={{ width: `${Math.max(3, fraction * 100)}%` }} />
          </div>
        )}
        {doc.status === "failed" && doc.error && (
          <p role="alert" className="text-danger mt-1 text-[13px]" data-testid="document-error">
            {doc.error}
          </p>
        )}
        {doc.warning && doc.status !== "failed" && (
          <p className="text-energy mt-1 flex items-center gap-1.5 text-[13px]" data-testid="document-warning">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {doc.warning}
          </p>
        )}
      </div>
      {doc.uploading === undefined && doc.status !== "deleting" && (
        <button
          type="button"
          onClick={() => onDelete(doc)}
          aria-label={`${doc.status === "ready" || doc.status === "failed" ? "Delete" : "Cancel and delete"} ${doc.title}`}
          title={doc.status === "ready" || doc.status === "failed" ? "Delete" : "Cancel"}
          data-testid="document-delete"
          className="text-muted hover:text-danger hover:bg-surface-2 grid size-9 shrink-0 place-items-center self-start rounded-md"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}
