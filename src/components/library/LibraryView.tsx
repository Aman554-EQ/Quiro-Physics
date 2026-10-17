"use client";

import { AlertDialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ApiError,
  deleteDocumentRequest,
  fetchLibrary,
  fetchStatus,
  notifyDocumentsChanged,
  uploadPdf,
  type LibraryState,
} from "@/lib/documents-client";

import { DocumentCard, type CardDocument } from "./DocumentCard";
import { Dropzone } from "./Dropzone";
import { formatSlot, QuotaMeter } from "./QuotaMeter";

const POLL_MS = 1_500;
const HIDDEN_POLL_MS = 10_000;
/** Nothing in progress: check rarely (a document can still change, e.g. deleted in another tab). */
const IDLE_POLL_MS = 15_000;
const BUSY = new Set<string>(["reserved", "queued", "processing"]);

function uploadErrorMessage(err: unknown) {
  if (err instanceof ApiError) {
    if (err.code === "WEEKLY_UPLOAD_LIMIT" && err.resetAt)
      return `You've used this week's uploads. Your next upload slot opens ${formatSlot(err.resetAt)}.`;
    return err.message;
  }
  return "The upload didn't finish. Please try again.";
}

/** Library: quotas, drop zone and the user's PDFs with live processing status. */
export function LibraryView({ initial }: { initial: LibraryState }) {
  const [state, setState] = useState<Omit<LibraryState, "documents"> & { documents: CardDocument[] }>(initial);
  const [uploading, setUploading] = useState<CardDocument | null>(null);
  const [confirm, setConfirm] = useState<CardDocument | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await fetchLibrary();
      if (mounted.current) setState(next);
    } catch {
      // keep the last good state
    }
  }, []);

  // Live status: poll every document that is still being processed (the status call also
  // restarts stalled jobs) with a self-scheduling loop that always reads the latest state, so new
  // uploads join without a page refresh. A hidden tab polls slowly and catches up when shown.
  const stateRef = useRef(state);
  const uploadingRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
    uploadingRef.current = uploading !== null;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      const ids = stateRef.current.documents.filter((d) => BUSY.has(d.status)).map((d) => d.id);
      if (ids.length) {
        const updates = await Promise.all(ids.map((id) => fetchStatus(id).catch(() => null)));
        if (stopped || !mounted.current) return;
        const receivedAt = Date.now();
        setState((s) => ({
          ...s,
          documents: s.documents.map((d) => {
            const u = updates.find((x) => x?.id === d.id);
            return u ? { ...u, receivedAt } : d;
          }),
        }));
        if (updates.some((u) => u && !BUSY.has(u.status))) {
          void refresh();
          notifyDocumentsChanged();
        }
      }
      if (stopped) return;
      const visible = typeof document === "undefined" || document.visibilityState !== "hidden";
      timer = setTimeout(tick, ids.length || uploadingRef.current ? (visible ? POLL_MS : HIDDEN_POLL_MS) : IDLE_POLL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };
    timer = setTimeout(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const onFile = async (file: File) => {
    const placeholder: CardDocument = {
      id: "uploading",
      title: file.name.replace(/\.pdf$/i, ""),
      originalFilename: file.name,
      status: "reserved",
      sizeBytes: file.size,
      pageCount: null,
      chunkCount: 0,
      error: null,
      warning: null,
      createdAt: new Date().toISOString(),
      readyAt: null,
      progress: null,
      uploading: 0,
    };
    setUploading(placeholder);
    try {
      const doc = await uploadPdf(file, (f) => mounted.current && setUploading((u) => (u ? { ...u, uploading: f } : u)));
      // Show the real card at once (status polling picks it up from here).
      if (mounted.current) setState((s) => ({ ...s, documents: [doc, ...s.documents.filter((d) => d.id !== doc.id)] }));
      toast.success("Uploaded. Processing has started.");
    } catch (err) {
      toast.error(uploadErrorMessage(err));
    } finally {
      if (mounted.current) setUploading(null);
      await refresh();
      notifyDocumentsChanged();
    }
  };

  const onDelete = async (doc: CardDocument) => {
    setConfirm(null);
    setState((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== doc.id) }));
    try {
      await deleteDocumentRequest(doc.id);
      toast.success(`Deleted "${doc.title}"`);
    } catch {
      toast.error("Couldn't delete that PDF. Please try again.");
    } finally {
      await refresh();
      notifyDocumentsChanged();
    }
  };

  const weekFull = state.uploads.used >= state.uploads.limit;
  const activeFull = state.active.used >= state.active.limit;
  const blockedReason = weekFull
    ? state.uploads.nextSlotAt
      ? `Next upload slot: ${formatSlot(state.uploads.nextSlotAt)}`
      : "This week's uploads are used"
    : activeFull
      ? "Delete a PDF to add another"
      : undefined;
  const docs: CardDocument[] = uploading ? [uploading, ...state.documents] : state.documents;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <QuotaMeter uploads={state.uploads} active={state.active} />
      <Dropzone
        maxSizeMb={state.maxSizeMb}
        maxPages={state.maxPages}
        disabled={Boolean(uploading) || weekFull || activeFull}
        disabledReason={uploading ? "Uploading…" : blockedReason}
        onFile={onFile}
      />
      {docs.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Your PDFs" data-testid="document-list">
          {docs.map((d) => (
            <DocumentCard key={d.id} doc={d} onDelete={setConfirm} />
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">No PDFs yet. Upload a textbook chapter to get answers that cite its pages.</p>
      )}

      <AlertDialog.Root open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Content className="border-border bg-surface fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border p-5">
            <AlertDialog.Title className="text-lg font-semibold">Delete this PDF?</AlertDialog.Title>
            <AlertDialog.Description className="text-muted mt-2 text-sm">
              &ldquo;{confirm?.title}&rdquo; and its search index are removed. Old answers keep their quotes, marked as
              source deleted. This frees an active slot; it doesn&apos;t give back a weekly upload.
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Keep it</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="danger" onClick={() => confirm && onDelete(confirm)} data-testid="confirm-delete">
                  Delete
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
