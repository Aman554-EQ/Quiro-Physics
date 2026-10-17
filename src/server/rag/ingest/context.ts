import "server-only";

import type { DocumentRow, JobRow } from "@/db/schema";
import type { Db } from "@/server/db";
import type { BlobStore } from "@/server/storage/blob";

import type { PhysicsEmbeddings } from "../embeddings";

/** What a stage batch gets. Stages are idempotent and cursor-based: re-running a batch is safe. */
export interface StageContext {
  db: Db;
  doc: DocumentRow;
  job: JobRow;
  blobs: BlobStore;
  embeddings: PhysicsEmbeddings;
  /** Epoch ms: stop starting new work after this. */
  deadline: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

/** done: the stage finished; otherwise the job continues with the saved cursor next slice. */
export interface StageResult {
  done: boolean;
  /** Stop this slice now (e.g. a rate-limit wait would pass the deadline). */
  yield?: boolean;
  /** Don't continue before this time (epoch ms): the provider's quota is used up until then. */
  waitUntil?: number;
  waitReason?: QuotaWait;
}

/** Why a job is paused (stored in `last_error` as `quota_wait:<reason>`, shown on the card). */
export type QuotaWait = "daily_quota" | "rate_limit";
export const QUOTA_WAIT_PREFIX = "quota_wait:";

/** A failure caused by the file (not refunded): encrypted, too many pages, too many chunks, unreadable. */
export class FileFaultError extends Error {
  readonly fault = "file" as const;
  constructor(message: string) {
    super(message);
    this.name = "FileFaultError";
  }
}

export const isFileFault = (err: unknown) => (err as { fault?: string } | null)?.fault === "file";
