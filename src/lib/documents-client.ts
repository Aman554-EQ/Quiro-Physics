"use client";

import type { DocumentSummary } from "@/shared/documents";

/** Browser side of /api/documents (Library and the chat document selector). */
export interface LibraryState {
  documents: DocumentSummary[];
  uploads: { used: number; limit: number; nextSlotAt: string | null };
  active: { used: number; limit: number };
  maxSizeMb: number;
  maxPages: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly resetAt?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function json<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; resetAt?: string } } | null;
  throw new ApiError(
    res.status,
    body?.error?.code ?? "HTTP_ERROR",
    body?.error?.message ?? "Something went wrong. Please try again.",
    body?.error?.resetAt,
  );
}

export const DOCUMENTS_CHANGED = "quiro:documents-changed";
export const notifyDocumentsChanged = () => window.dispatchEvent(new Event(DOCUMENTS_CHANGED));

export const fetchLibrary = () => fetch("/api/documents", { cache: "no-store" }).then((r) => json<LibraryState>(r));

export const fetchStatus = (id: string) =>
  fetch(`/api/documents/${id}/status`, { cache: "no-store" }).then((r) => json<DocumentSummary>(r));

export const deleteDocumentRequest = (id: string) =>
  fetch(`/api/documents/${id}`, { method: "DELETE" }).then((r) => json<void>(r));

export const renameDocumentRequest = (id: string, title: string) =>
  fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  }).then((r) => json<DocumentSummary>(r));

export const saveConversationDocuments = (conversationId: string, documentIds: string[]) =>
  fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ documentIds }),
  }).then((r) => json<unknown>(r));

function putWithProgress(url: string, file: File, onProgress: (f: number) => void) {
  return new Promise<{ pathname: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "application/pdf");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const res = new Response(xhr.responseText, { status: xhr.status, headers: { "content-type": "application/json" } });
      json<{ pathname: string }>(res).then(resolve, reject);
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "The upload was interrupted. Check your connection and retry."));
    xhr.send(file);
  });
}

/**
 * Reserve → upload (Vercel Blob client upload, or the local file endpoint) → complete.
 * A failure after reserving leaves the reservation to expire (30 min) or be released by /complete.
 */
export async function uploadPdf(file: File, onProgress: (fraction: number) => void): Promise<DocumentSummary> {
  const reserved = await fetch("/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, sizeBytes: file.size }),
  }).then((r) =>
    json<{ document: DocumentSummary; upload: { mode: "blob" | "local"; pathname: string } }>(r),
  );
  const id = reserved.document.id;
  let pathname: string;
  if (reserved.upload.mode === "blob") {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(reserved.upload.pathname, file, {
      access: "private",
      handleUploadUrl: "/api/documents/upload",
      clientPayload: JSON.stringify({ documentId: id }),
      contentType: "application/pdf",
      onUploadProgress: (p) => onProgress(p.percentage / 100),
    });
    pathname = blob.pathname;
  } else {
    pathname = (await putWithProgress(`/api/documents/${id}/file`, file, onProgress)).pathname;
  }
  onProgress(1);
  return fetch(`/api/documents/${id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pathname }),
  }).then((r) => json<DocumentSummary>(r));
}
