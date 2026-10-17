/**
 * Document (PDF) contracts shared by the server, the Library UI and the chat document selector.
 */
import { z } from "zod";

export const DOCUMENT_STATUSES = ["reserved", "queued", "processing", "ready", "failed", "deleting"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const JOB_STAGES = ["extract", "chunk", "embed", "finalize", "done"] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export type ChunkType = "prose" | "equation" | "worked_example" | "definition" | "table" | "summary";

export interface ChunkEquation {
  latex: string;
  label?: string;
  page: number;
}

/** Statuses that occupy one of the user's active-document slots (LIMITS_AND_QUOTAS.md §1). */
export const ACTIVE_STATUSES: DocumentStatus[] = ["reserved", "queued", "processing", "ready"];

export interface DocumentProgress {
  stage: JobStage;
  /** 0–1 overall, weighted by the expected time of each stage. */
  fraction: number;
  /** "Reading pages 25/100" etc. */
  label: string;
  /** Estimated seconds left (null while the page count is unknown). */
  etaSeconds?: number | null;
  /** Paused until the embedding provider's quota resets (ISO time). */
  pausedUntil?: string | null;
}

export interface DocumentSummary {
  id: string;
  title: string;
  originalFilename: string;
  status: DocumentStatus;
  sizeBytes: number;
  pageCount: number | null;
  chunkCount: number;
  error: string | null;
  warning: string | null;
  createdAt: string;
  readyAt: string | null;
  progress: DocumentProgress | null;
}

/** Error codes for uploads (HTTP body `{ error: { code, message, resetAt? } }`). */
export const UPLOAD_ERROR_CODES = [
  "WEEKLY_UPLOAD_LIMIT",
  "ACTIVE_DOCUMENT_LIMIT",
  "STORAGE_FULL",
  "FILE_TOO_LARGE",
  "NOT_A_PDF",
  "DUPLICATE_DOCUMENT",
  "UPLOAD_MISSING",
  "UPLOADS_UNAVAILABLE",
] as const;

/** Client-side checks run before any request (P3-S2-A12); the server repeats them. */
export function checkFileBeforeUpload(file: { name: string; size: number; type: string }, maxMb: number): string | null {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return "Only PDF files can be uploaded.";
  if (file.size > maxMb * 1024 * 1024) return `This file is too large (max ${maxMb} MB).`;
  if (file.size === 0) return "This file is empty.";
  return null;
}

export const DocumentSelectionSchema = z.array(z.string().uuid()).max(5);

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
