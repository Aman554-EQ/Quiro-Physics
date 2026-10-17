import "server-only";

import { runAfter } from "@/server/after";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { logger } from "@/server/log";
import { getBlobStore } from "@/server/storage/blob";

import { getEmbeddings } from "../embeddings";

import { runJob } from "./job-runner";

/**
 * Starting and continuing ingestion.
 * - Locally (and in tests) the next slice runs in this process, after the response.
 * - On Vercel each slice must be a fresh invocation (300 s limit), so a finished slice calls
 *   POST /api/documents/[id]/process with INTERNAL_JOB_SECRET. If that call is lost, the
 *   status poll re-kicks a job whose lease has expired (watchdog), so nothing stays stuck.
 */
const CONTINUE_DELAY_MS = 1_000;

/**
 * Where the next slice is sent. The per-deployment VERCEL_URL sits behind Vercel's Deployment
 * Protection by default (the self-call would get 401), so production uses its public domain
 * (VERCEL_PROJECT_PRODUCTION_URL) when NEXT_PUBLIC_APP_URL isn't set.
 */
export function baseUrl(e: Record<string, string | undefined> = process.env) {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (e.VERCEL_ENV === "production" && e.VERCEL_PROJECT_PRODUCTION_URL) return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return null;
}

let kickOverride: ((documentId: string) => void) | null = null;

/** Tests replace the trigger with a spy (P3-S2-A07, P3-S3-A14). */
export function setKickForTests(fn: ((documentId: string) => void) | null) {
  kickOverride = fn;
}

export function scheduleContinuation(documentId: string) {
  if (kickOverride) return kickOverride(documentId);
  const base = baseUrl();
  if (process.env.VERCEL && base && env.INTERNAL_JOB_SECRET) {
    runAfter(async () => {
      const res = await fetch(`${base}/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "x-internal-job-secret": env.INTERNAL_JOB_SECRET! },
      }).catch(() => null);
      if (!res?.ok) logger.warn("ingest.continue_failed", { documentId, status: res?.status ?? null });
    });
    return;
  }
  runAfter(async () => {
    await new Promise((r) => setTimeout(r, CONTINUE_DELAY_MS));
    await processNow(documentId);
  });
}

/** Run one slice now (inside the current request's lifetime). */
export async function processNow(documentId: string) {
  const blobs = getBlobStore();
  if (!blobs) return "stopped" as const;
  return runJob(documentId, {
    db: await getDb(),
    blobs,
    embeddings: getEmbeddings(),
    continueLater: scheduleContinuation,
  });
}

/** Start processing after the response (upload completed, watchdog). */
export function kickProcessing(documentId: string) {
  if (kickOverride) return kickOverride(documentId);
  runAfter(() => processNow(documentId));
}
