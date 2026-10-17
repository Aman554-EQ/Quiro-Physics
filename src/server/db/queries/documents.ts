import "server-only";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { conversationDocuments, conversations, documentProcessingJobs, documents, type DocumentRow, type JobRow } from "@/db/schema";
import type { Db } from "@/server/db";
import { getEmbeddings } from "@/server/rag/embeddings";
import { QUOTA_WAIT_PREFIX } from "@/server/rag/ingest/context";
import type { DocumentProgress, DocumentSummary } from "@/shared/documents";

/** Seconds per page to read and save it (about 0.004 s to parse; round trips to Neon add the rest). */
export const EXTRACT_SECONDS_PER_PAGE = 0.03;
/** Passages per page in real textbooks with ~500-token passages (a 246-page book gave 307). */
export const PASSAGES_PER_PAGE = 1.3;
const FINALIZE_SECONDS = 2;

/** Embedding requests per minute of the embeddings in use (null: no limit, offline hash). */
function embedRate(): number | null {
  try {
    return getEmbeddings().requestsPerMinute ?? null;
  } catch {
    return null;
  }
}

/**
 * Progress shown on the Library card ("Reading pages 25/100", "Indexing passages 120/306") with
 * an estimate of the time left. Embedding dominates on Gemini's free tier (one request per
 * passage, ~95 a minute), so the bar and the estimate are weighted by expected time per stage.
 */
export function progressOf(
  doc: Pick<DocumentRow, "status" | "pageCount">,
  job: Pick<JobRow, "stage" | "cursor" | "total" | "leaseUntil" | "lastError"> | null,
  opts: { now?: number; perMinute?: number | null } = {},
): DocumentProgress | null {
  if (!job || (doc.status !== "processing" && doc.status !== "queued")) return null;
  const now = opts.now ?? Date.now();
  const perMinute = opts.perMinute === undefined ? embedRate() : opts.perMinute;
  const embedSeconds = (passages: number) => (perMinute ? (passages / perMinute) * 60 : passages * 0.005);
  const total = job.total ?? 0;
  const pages = job.stage === "extract" ? total || null : doc.pageCount;
  const passages = job.stage === "embed" || job.stage === "finalize" ? total : pages ? Math.ceil(pages * PASSAGES_PER_PAGE) : null;
  const extractAll = pages ? pages * EXTRACT_SECONDS_PER_PAGE : 0;
  const all = pages !== null && passages !== null ? extractAll + embedSeconds(passages) + FINALIZE_SECONDS : null;
  const paused =
    job.leaseUntil && job.leaseUntil.getTime() > now && job.lastError?.startsWith(QUOTA_WAIT_PREFIX) ? job.leaseUntil.toISOString() : null;

  let done = 0;
  let label: string;
  switch (job.stage) {
    case "extract":
      done = job.cursor * EXTRACT_SECONDS_PER_PAGE;
      label = total ? `Reading pages ${job.cursor}/${total}` : "Opening the PDF";
      break;
    case "chunk":
      done = extractAll;
      label = "Finding sections, equations and examples";
      break;
    case "embed":
      done = extractAll + embedSeconds(job.cursor);
      label = total ? `Indexing passages ${job.cursor}/${total}` : "Indexing passages";
      break;
    case "finalize":
      done = all ? all - FINALIZE_SECONDS : 0;
      label = "Finishing";
      break;
    default:
      return null;
  }
  if (paused) label = "Paused: the free daily embedding quota is used up";
  const fraction = all ? Math.min(0.99, done / all) : 0;
  const waitSeconds = paused ? (new Date(paused).getTime() - now) / 1000 : 0;
  return {
    stage: job.stage,
    fraction,
    label,
    etaSeconds: all !== null ? Math.max(1, Math.round(all - done + waitSeconds)) : null,
    pausedUntil: paused,
  };
}

export function toSummary(doc: DocumentRow, job: JobRow | null): DocumentSummary {
  return {
    id: doc.id,
    title: doc.title,
    originalFilename: doc.originalFilename,
    status: doc.status,
    sizeBytes: doc.sizeBytes,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    error: doc.error,
    warning: doc.warning,
    createdAt: doc.createdAt.toISOString(),
    readyAt: doc.readyAt?.toISOString() ?? null,
    progress: progressOf(doc, job),
  };
}

/** The user's documents (newest first), without ones being deleted. */
export async function listDocuments(db: Db, userId: string): Promise<DocumentSummary[]> {
  const rows = await db
    .select({ doc: documents, job: documentProcessingJobs })
    .from(documents)
    .leftJoin(documentProcessingJobs, eq(documentProcessingJobs.documentId, documents.id))
    .where(and(eq(documents.userId, userId), ne(documents.status, "deleting")))
    .orderBy(desc(documents.createdAt));
  return rows.map((r) => toSummary(r.doc, r.job));
}

/** Ownership-checked fetch: someone else's id behaves exactly like a missing one. */
export async function getOwnedDocument(db: Db, userId: string, documentId: string) {
  const [row] = await db
    .select({ doc: documents, job: documentProcessingJobs })
    .from(documents)
    .leftJoin(documentProcessingJobs, eq(documentProcessingJobs.documentId, documents.id))
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  return row ?? null;
}

/** Ready documents among `ids` that belong to the user (others are silently dropped). */
export async function readyDocuments(db: Db, userId: string, ids: string[]) {
  if (!ids.length) return [];
  return db
    .select({ id: documents.id, title: documents.title, embeddingModel: documents.embeddingModel })
    .from(documents)
    .where(and(eq(documents.userId, userId), inArray(documents.id, ids), eq(documents.status, "ready")));
}

/** Documents selected for a conversation (ownership via the conversation). */
export async function conversationDocumentIds(db: Db, userId: string, conversationId: string) {
  const rows = await db
    .select({ id: conversationDocuments.documentId })
    .from(conversationDocuments)
    .innerJoin(conversations, eq(conversations.id, conversationDocuments.conversationId))
    .where(and(eq(conversationDocuments.conversationId, conversationId), eq(conversations.userId, userId)));
  return rows.map((r) => r.id);
}

/** Replace a conversation's document selection. Callers have checked ownership of both sides. */
export async function setConversationDocuments(db: Db, conversationId: string, documentIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(conversationDocuments).where(eq(conversationDocuments.conversationId, conversationId));
    if (documentIds.length)
      await tx.insert(conversationDocuments).values(documentIds.map((documentId) => ({ conversationId, documentId })));
  });
}

/** The subset of `ids` the user owns (any status except deleting), in the given order. */
export async function ownedDocumentIds(db: Db, userId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), inArray(documents.id, ids), ne(documents.status, "deleting")));
  const owned = new Set(rows.map((r) => r.id));
  return [...new Set(ids)].filter((id) => owned.has(id));
}
