import "server-only";

import { estimateTokens } from "@/server/chat/tokens";

/** Retrieval maths (RAG_PIPELINE.md §6): RRF, de-duplication, MMR, token budget. Pure functions. */
export const RRF_K = 60;
export const FUSED_TOP = 12;
export const FINAL_TOP = 6;
export const MMR_LAMBDA = 0.7;
export const DEDUPE_COSINE = 0.92;
/** About five ~500-token passages. */
export const EVIDENCE_TOKENS = 2_600;

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Reciprocal Rank Fusion: score(d) = Σ 1 / (k + rank), ranks 1-based. Ties keep first-seen order. */
export function rrf(lists: string[][], k = RRF_K): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

export interface Candidate {
  id: string;
  vector: number[];
  /** Similarity to the query (cosine). */
  relevance: number;
}

/** Drop near-duplicates (cosine > 0.92 to a higher-ranked candidate). Input in rank order. */
export function dedupe<T extends Candidate>(ranked: T[], threshold = DEDUPE_COSINE): T[] {
  const kept: T[] = [];
  for (const c of ranked) if (!kept.some((k) => cosine(k.vector, c.vector) > threshold)) kept.push(c);
  return kept;
}

/** Maximal Marginal Relevance: λ·relevance − (1−λ)·max similarity to what's already picked. */
export function mmr<T extends Candidate>(candidates: T[], k = FINAL_TOP, lambda = MMR_LAMBDA): T[] {
  const picked: T[] = [];
  const pool = [...candidates];
  while (picked.length < k && pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      const redundancy = picked.length ? Math.max(...picked.map((p) => cosine(p.vector, c.vector))) : 0;
      const score = lambda * c.relevance - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    picked.push(pool.splice(best, 1)[0]!);
  }
  return picked;
}

/** Keep the highest-ranked chunks within the evidence budget (lowest-ranked removed first). */
export function fitBudget<T extends { content: string }>(ranked: T[], budget = EVIDENCE_TOKENS): T[] {
  const out: T[] = [];
  let used = 0;
  for (const c of ranked) {
    const t = estimateTokens(c.content);
    if (used + t > budget) {
      if (out.length === 0) out.push(c); // never return nothing: the best chunk is trimmed later
      continue;
    }
    out.push(c);
    used += t;
  }
  return out;
}

/** Ends mid-derivation: no closing punctuation, or a trailing "=", ":" or operator. */
export const looksTruncated = (content: string) => !/[.!?)\]"]\s*$/.test(content.trim()) || /[=:+\-×]\s*$/.test(content.trim());
