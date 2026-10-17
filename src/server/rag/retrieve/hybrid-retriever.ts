import "server-only";

import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import { documentChunks, documents } from "@/db/schema";
import type { Db } from "@/server/db";
import { logger } from "@/server/log";
import type { ChunkType } from "@/shared/documents";

import { HASH_EMBEDDING_MODEL, type PhysicsEmbeddings } from "../embeddings";
import { OVERVIEW_SECTION } from "../ingest/splitter";

import { cosine, dedupe, FINAL_TOP, fitBudget, FUSED_TOP, looksTruncated, mmr, rrf } from "./rank";

/**
 * HybridPgRetriever (RAG_PIPELINE.md §6): vector top 24 (cosine on halfvec) + keyword top 24
 * (full-text search), both filtered by user_id AND the selected, ready documents → RRF → top 12 →
 * de-duplicate → MMR → 6 → adjacent expansion for cut-off equations/examples → token budget.
 * `user_id` comes from the session, never from the client; a foreign document id simply matches
 * nothing (P3-S5-A04).
 */
export const VECTOR_TOP = 24;
export const KEYWORD_TOP = 24;

/**
 * Below this best cosine similarity the evidence is "weak" (per model). Gemini, measured on a real
 * 246-page textbook: questions it answers score 0.69 to 0.75, physics it doesn't cover about 0.63,
 * unrelated questions ("a cake recipe", "the 2018 world cup") 0.51 to 0.55.
 */
export const WEAK_SIMILARITY: Record<string, number> = { [HASH_EMBEDDING_MODEL]: 0.16, "gemini-embedding-001": 0.6 };

/** Questions about the document itself: its "About this document" passage always joins the evidence. */
export const BOOK_META =
  /\b(authors?|writers?|wrote|written|editors?|edited|publisher|published|translat\w*|edition|chapters?|contents|syllabus|(about|summari[sz]e|overview of) (the|this|my) (book|textbook|pdf|document))\b/i;

export interface EvidenceChunk {
  label: number;
  chunkId: string;
  documentId: string;
  title: string;
  section: string | null;
  pageStart: number;
  pageEnd: number;
  chunkIndex: number;
  chunkType: ChunkType;
  content: string;
  score: number;
  similarity: number;
}

export interface RetrievalResult {
  evidence: EvidenceChunk[];
  strength: "strong" | "weak" | "none";
  bestSimilarity: number;
}

const parseVector = (v: unknown): number[] =>
  Array.isArray(v) ? (v as number[]) : typeof v === "string" ? (JSON.parse(v) as number[]) : [];

/** Question words that every question shares: matching them says nothing about relevance. */
const QUESTION_WORDS = new Set(
  "explain describe define definition tell me about give show please briefly detail details example examples mean meaning means book textbook pdf chapter page discuss state write find".split(" "),
);

/** Plain words joined with "or": any matching term counts, ts_rank_cd orders by how many match. */
export function keywordQuery(q: string) {
  const all = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const words = all.filter((w) => !QUESTION_WORDS.has(w));
  return (words.length ? words : all).slice(0, 24).join(" or ");
}

const rowsOf = <T>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows: T[] }).rows ?? []));

export interface RetrieveInput {
  userId: string;
  documentIds: string[];
  query: string;
}

export async function hybridRetrieve(db: Db, embeddings: PhysicsEmbeddings, input: RetrieveInput): Promise<RetrievalResult> {
  if (!input.documentIds.length || !input.query.trim()) return { evidence: [], strength: "none", bestSimilarity: 0 };
  // Only ready documents of this user, embedded with the model in use (vectors never mix).
  const docs = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(
      and(
        eq(documents.userId, input.userId),
        inArray(documents.id, input.documentIds),
        eq(documents.status, "ready"),
        eq(documents.embeddingModel, embeddings.modelId),
      ),
    );
  if (!docs.length) return { evidence: [], strength: "none", bestSimilarity: 0 };
  const ids = docs.map((d) => d.id);
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  // A failed query embedding (e.g. Gemini's per-minute limit while a book is being indexed)
  // falls back to keyword search instead of answering without the book.
  let qv: number[] | null = null;
  try {
    qv = await embeddings.embedQuery(input.query);
  } catch (err) {
    logger.warn("rag.query_embedding_failed", { name: (err as Error)?.name ?? "unknown" });
  }
  const idList = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);

  const vec = qv
    ? rowsOf<{ id: string }>(
        await db.execute(sql`
          select c.id from ${documentChunks} c
          where c.user_id = ${input.userId} and c.document_id in (${idList}) and c.embedding is not null
          order by c.embedding <=> ${`[${qv.join(",")}]`}::halfvec(768) limit ${VECTOR_TOP}`),
      ).map((r) => r.id)
    : [];
  const kwText = keywordQuery(input.query);
  const kw = kwText
    ? rowsOf<{ id: string }>(
        await db.execute(sql`
          select c.id from ${documentChunks} c, websearch_to_tsquery('english', ${kwText}) q
          where c.user_id = ${input.userId} and c.document_id in (${idList}) and c.tsv @@ q
          order by ts_rank_cd(c.tsv, q) desc, c.chunk_index limit ${KEYWORD_TOP}`),
      ).map((r) => r.id)
    : [];

  // "Who wrote this book?": the overview passage (credits, chapter list) is the answer.
  const meta = BOOK_META.test(input.query)
    ? rowsOf<{ id: string }>(
        await db.execute(sql`
          select c.id from ${documentChunks} c
          where c.user_id = ${input.userId} and c.document_id in (${idList}) and c.section_path = ${OVERVIEW_SECTION}`),
      ).map((r) => r.id)
    : [];

  const fused = rrf(meta.length ? [meta, meta, vec, kw] : [vec, kw]).slice(0, FUSED_TOP);
  if (!fused.length) return { evidence: [], strength: "none", bestSimilarity: 0 };
  const rows = await db
    .select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      chunkIndex: documentChunks.chunkIndex,
      chunkType: documentChunks.chunkType,
      section: documentChunks.sectionPath,
      pageStart: documentChunks.pageStart,
      pageEnd: documentChunks.pageEnd,
      content: documentChunks.content,
      embedding: documentChunks.embedding,
    })
    .from(documentChunks)
    .where(and(eq(documentChunks.userId, input.userId), inArray(documentChunks.id, fused.map((f) => f.id))));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const top = fused[0]!.score;
  const ranked = fused.flatMap((f) => {
    const r = byId.get(f.id);
    if (!r) return [];
    const vector = parseVector(r.embedding);
    // MMR relevance is the fused (vector + keyword) score, so an exact-term hit isn't lost when
    // the vector ranking is poor (P3-S5-A07). Cosine is kept for the weak-evidence check.
    return [{ ...r, score: f.score, vector, relevance: f.score / top, similarity: qv ? cosine(qv, vector) : 0 }];
  });
  const bestSimilarity = Math.max(0, ...ranked.filter((r) => vec.includes(r.id) || meta.includes(r.id)).map((r) => r.similarity));

  let picked = mmr(dedupe(ranked), FINAL_TOP);
  // Keep rank order by fused score after MMR's diversity pick.
  picked = picked.sort((a, b) => b.score - a.score);

  // Adjacent expansion: a cut-off equation/worked example pulls its neighbours in the same section.
  const expansions = picked.filter((p) => (p.chunkType === "equation" || p.chunkType === "worked_example") && looksTruncated(p.content));
  if (expansions.length) {
    const neighbours = await db
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        chunkType: documentChunks.chunkType,
        section: documentChunks.sectionPath,
        pageStart: documentChunks.pageStart,
        pageEnd: documentChunks.pageEnd,
        content: documentChunks.content,
        embedding: documentChunks.embedding,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.userId, input.userId),
          or(
            ...expansions.map((p) =>
              and(eq(documentChunks.documentId, p.documentId), inArray(documentChunks.chunkIndex, [p.chunkIndex - 1, p.chunkIndex + 1])),
            ),
          ),
        ),
      );
    for (const p of expansions) {
      const idx = picked.indexOf(p);
      const add = neighbours
        .filter((n) => n.documentId === p.documentId && n.section === p.section && !picked.some((x) => x.id === n.id))
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((n) => {
          const vector = parseVector(n.embedding);
          return { ...n, score: p.score * 0.99, vector, relevance: p.relevance, similarity: qv ? cosine(qv, vector) : 0 };
        });
      picked.splice(idx + 1, 0, ...add);
    }
  }

  const final = fitBudget(picked);
  const threshold = WEAK_SIMILARITY[embeddings.modelId] ?? 0.5;
  const strong = bestSimilarity >= threshold || final.some((c) => meta.includes(c.id));
  return {
    evidence: final.map((c, i) => ({
      label: i + 1,
      chunkId: c.id,
      documentId: c.documentId,
      title: titles.get(c.documentId) ?? "Your textbook",
      section: c.section,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      chunkIndex: c.chunkIndex,
      chunkType: c.chunkType,
      content: c.content,
      score: c.score,
      similarity: c.similarity,
    })),
    strength: strong ? "strong" : "weak",
    bestSimilarity,
  };
}

/** LangChain retriever over the same pipeline (P3-S5-A11). */
export class HybridPgRetriever extends BaseRetriever {
  override lc_namespace = ["quiro", "retrievers"];
  constructor(
    private readonly deps: { db: Db; embeddings: PhysicsEmbeddings; userId: string; documentIds: string[] },
  ) {
    super();
  }
  override async _getRelevantDocuments(query: string): Promise<Document[]> {
    const { evidence } = await hybridRetrieve(this.deps.db, this.deps.embeddings, {
      userId: this.deps.userId,
      documentIds: this.deps.documentIds,
      query,
    });
    return evidence.map(
      (e) =>
        new Document({
          pageContent: e.content,
          metadata: {
            documentId: e.documentId,
            title: e.title,
            section: e.section,
            pageStart: e.pageStart,
            pageEnd: e.pageEnd,
            chunkId: e.chunkId,
            score: e.score,
          },
        }),
    );
  }
}
