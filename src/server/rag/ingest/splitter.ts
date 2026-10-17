import "server-only";

import { estimateTokens } from "@/server/chat/tokens";
import type { ChunkEquation, ChunkType } from "@/shared/documents";

import { detectEquation, isDefinitionLine, toSearchText } from "./normalize";
import { chapterTitle, detectHeading, looseChapter, SectionTracker, type Heading } from "./structure";

/**
 * PhysicsAwareSplitter (RAG_PIPELINE.md §3):
 * - atomic units, never split unless > 1,000 tokens: equation + the sentence before it + its
 *   "where…" definitions; worked example + solution; table + caption; definitions; summaries;
 * - prose packed sentence by sentence to ~500 tokens (max 800) with ~60 tokens of overlap;
 * - headings stay in the text of the passage they start ("Written by" travels with the names);
 * - small neighbouring pieces (a short paragraph, an equation, a credits block) are merged into
 *   passages of useful size within the same section (`mergeSmall`); tiny ones (a lone heading)
 *   may join across a section boundary. Real books produced hundreds of 1 to 20 token passages
 *   otherwise, which embed badly, cost one embedding request each and crowd out real evidence;
 * - `search_text` = "[title | section | p.N] " + normalised text (embedded and indexed).
 */
export const TARGET_TOKENS = 500;
export const MAX_TOKENS = 800;
export const OVERLAP_TOKENS = 60;
export const ATOMIC_MAX_TOKENS = 1_000;
/** Pieces smaller than this are merged with a neighbour in the same section. */
export const MIN_TOKENS = 200;
/** Pieces this small (a heading, a caption) may merge across a section boundary. */
export const TINY_TOKENS = 40;
export const MAX_CHUNKS = 900;

export interface PageText {
  page: number;
  text: string;
}

export interface ChunkDraft {
  chunkIndex: number;
  chunkType: ChunkType;
  sectionPath: string | null;
  pageStart: number;
  pageEnd: number;
  content: string;
  searchText: string;
  equations: ChunkEquation[];
  tokenCount: number;
}

interface Line {
  text: string;
  page: number;
}

interface Unit {
  type: ChunkType;
  section: string | null;
  /** Chapter + section: passages of useful size never merge across it. */
  scope: string;
  lines: Line[];
}

const EXAMPLE = /^(worked\s+)?example\s+\d+(\.\d+)*\b/i;
const TABLE = /^table\s+\d+(\.\d+)*\b/i;
const SUMMARY = /^(summary|key equations|chapter summary|key concepts)\b/i;
const DEFINITION = /\b(is defined as|is called the|we define)\b/i;
const EXAMPLE_PART = /^(strategy|solution|significance|check your understanding|discussion|\([a-z]\))/i;

/** Split pages into typed units, never crossing a heading. */
export function toUnits(pages: PageText[]): Unit[] {
  const lines: Line[] = pages.flatMap((p) => p.text.split("\n").map((text) => ({ text, page: p.page })));
  const sections = new SectionTracker();
  const units: Unit[] = [];
  let prose: Line[] = [];
  let summaryMode = false;
  const unit = (type: ChunkType, body: Line[]): Unit => ({ type, section: sections.path, scope: sections.scope, lines: body });
  const flushProse = () => {
    if (prose.some((l) => l.text.trim())) units.push(unit(summaryMode ? "summary" : "prose", prose));
    prose = [];
  };
  const nextIndex = (k: number) => {
    let j = k + 1;
    while (j < lines.length && !lines[j]!.text.trim()) j++;
    return j < lines.length ? j : -1;
  };
  const nextText = (k: number) => {
    const j = nextIndex(k);
    return j < 0 ? "" : lines[j]!.text;
  };
  let lastChapter = 0;
  const headingAt = (k: number): Heading | null => {
    const h = detectHeading(lines[k]!.text, nextText(k));
    if (h || !looseChapter(lines[k]!.text)) return h;
    const title = chapterTitle(nextText(k));
    return title && title !== nextText(k).trim() ? { level: 1, label: `Ch ${lastChapter + 1}`, needsTitle: true } : null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.text.trim();
    const heading = t ? headingAt(i) : null;
    if (heading && !EXAMPLE.test(t) && !TABLE.test(t)) {
      flushProse();
      const headingLines = [line];
      if (heading.needsTitle) {
        // "Chapter Two" then "MOTION": the title is the next line.
        const j = nextIndex(i);
        const title = j >= 0 ? chapterTitle(lines[j]!.text) : null;
        if (title) {
          heading.label = `${heading.label} ${title}`;
          headingLines.push(lines[j]!);
          i = j;
        }
      }
      if (heading.level === 1) lastChapter = Number(heading.label.match(/^Ch (\d+)/)?.[1] ?? lastChapter);
      sections.enter(heading);
      summaryMode = SUMMARY.test(heading.label.replace(/^\d+(\.\d+)*\s+/, ""));
      // The heading stays in the text: the passage it starts says what it is about.
      prose.push(...headingLines);
      continue;
    }
    if (SUMMARY.test(t) && t.length < 40) {
      flushProse();
      summaryMode = true;
      prose.push(line);
      continue;
    }

    if (EXAMPLE.test(t)) {
      flushProse();
      const body = [line];
      // Problem, Strategy, Solution, Significance… until the next heading, example, table or
      // summary, or the first paragraph break after the solution.
      let solved = false;
      while (i + 1 < lines.length) {
        const next = lines[i + 1]!.text.trim();
        if (EXAMPLE.test(next) || TABLE.test(next) || (SUMMARY.test(next) && next.length < 40)) break;
        if (next && headingAt(i + 1) && !EXAMPLE_PART.test(next)) break;
        if (!next && solved) {
          const after = lines.slice(i + 2).find((l) => l.text.trim())?.text.trim() ?? "";
          if (!EXAMPLE_PART.test(after)) break;
        }
        if (/^solution\b/i.test(next)) solved = true;
        body.push(lines[++i]!);
      }
      units.push(unit("worked_example", body));
      continue;
    }

    if (TABLE.test(t)) {
      flushProse();
      const body = [line];
      // Rows until a blank line, a heading or a line that reads like prose (extracted PDF text
      // rarely keeps blank lines).
      const prosey = (s: string) => s.split(/\s+/).length >= 9 && !/\d.*\d.*\d/.test(s);
      while (i + 1 < lines.length) {
        const next = lines[i + 1]!.text.trim();
        if (!next || headingAt(i + 1) || prosey(next)) break;
        body.push(lines[++i]!);
      }
      units.push(unit("table", body));
      continue;
    }

    if (detectEquation(t).isEquation) {
      // The sentence that introduces the equation moves into the equation unit.
      // Last line, plus earlier lines of the same sentence (they don't end with . ! ?), max 3.
      const lead: Line[] = [];
      if (prose.at(-1)?.text.trim()) lead.unshift(prose.pop()!);
      while (lead.length && lead.length < 3 && prose.at(-1)?.text.trim() && !/[.!?]\s*$/.test(prose.at(-1)!.text))
        lead.unshift(prose.pop()!);
      flushProse();
      const body = [...lead, line];
      while (i + 1 < lines.length && detectEquation(lines[i + 1]!.text).isEquation) body.push(lines[++i]!);
      // "where v0 is the initial speed and g …" (may wrap over a few lines)
      if (i + 1 < lines.length && isDefinitionLine(lines[i + 1]!.text)) {
        let taken = 0;
        while (i + 1 < lines.length && lines[i + 1]!.text.trim() && taken < 6) {
          body.push(lines[++i]!);
          taken++;
          if (/\.\s*$/.test(lines[i]!.text)) break;
        }
      }
      units.push(unit("equation", body));
      continue;
    }

    if (DEFINITION.test(t) && !prose.length) {
      const body = [line];
      while (i + 1 < lines.length && lines[i + 1]!.text.trim() && body.length < 6) {
        body.push(lines[++i]!);
        if (/\.\s*$/.test(lines[i]!.text)) break;
      }
      units.push(unit("definition", body));
      continue;
    }

    prose.push(line);
  }
  flushProse();
  return units;
}

const joinLines = (lines: Line[]) =>
  lines
    .map((l) => l.text)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

interface Sentence {
  text: string;
  pageStart: number;
  pageEnd: number;
  tokens: number;
}

/** A sentence ends at . ! ? followed by a capital, digit or "(", but not after "Dr." or "Fig.". */
const SENTENCE_END = /(?<=[.!?])(?<!\b(?:Dr|Mr|Mrs|Ms|Prof|Md|Fig|Figs|Eq|Eqs|No|vs|St|Ltd|Co)\.)\s+(?=[A-Z(\d])/;
/** Short lines without closing punctuation (headings, names, list items) keep their line break. */
const keepsBreak = (line: string) => line.trim().split(/\s+/).length <= 6 && !/[.!?,;]$/.test(line.trim());

/** Sentences of a prose unit, each with the pages it spans. Paragraph breaks become "\n\n". */
function sentences(lines: Line[]): Sentence[] {
  const out: Sentence[] = [];
  let cur = "";
  let start = lines[0]?.page ?? 1;
  let end = start;
  let sep = " ";
  const push = () => {
    const text = cur.trim();
    if (text) out.push({ text, pageStart: start, pageEnd: end, tokens: estimateTokens(text) });
    cur = "";
  };
  for (const l of lines) {
    if (!l.text.trim()) {
      push();
      if (out.length) out[out.length - 1]!.text += "\n";
      continue;
    }
    const parts = l.text.split(SENTENCE_END);
    parts.forEach((part, k) => {
      if (!cur) start = l.page;
      cur += (cur ? (k === 0 ? sep : " ") : "") + part;
      end = l.page;
      if (k < parts.length - 1 || /[.!?]\s*$/.test(part)) push();
    });
    sep = keepsBreak(l.text) ? "\n" : " ";
  }
  push();
  return out;
}

function packProse(sents: Sentence[]): Sentence[][] {
  const chunks: Sentence[][] = [];
  let cur: Sentence[] = [];
  let tokens = 0;
  for (const s of sents) {
    if (cur.length && tokens + s.tokens > MAX_TOKENS) {
      chunks.push(cur);
      // Overlap: the last sentence(s), ~60 tokens.
      const carry: Sentence[] = [];
      let t = 0;
      for (let k = cur.length - 1; k >= 0 && t + cur[k]!.tokens <= OVERLAP_TOKENS * 1.5; k--) {
        carry.unshift(cur[k]!);
        t += cur[k]!.tokens;
        if (t >= OVERLAP_TOKENS * 0.6) break;
      }
      cur = [...carry];
      tokens = t;
    }
    cur.push(s);
    tokens += s.tokens;
    if (tokens >= TARGET_TOKENS && /[.!?]\n?$/.test(s.text)) {
      chunks.push(cur);
      const carry: Sentence[] = [];
      let t = 0;
      for (let k = cur.length - 1; k >= 0 && t + cur[k]!.tokens <= OVERLAP_TOKENS * 1.5; k--) {
        carry.unshift(cur[k]!);
        t += cur[k]!.tokens;
        if (t >= OVERLAP_TOKENS * 0.6) break;
      }
      cur = carry;
      tokens = t;
    }
  }
  // The tail: only if it adds something beyond the carried overlap.
  const lastChunk = chunks.at(-1);
  if (cur.length && (!lastChunk || cur.some((s) => !lastChunk.includes(s)))) chunks.push(cur);
  return chunks;
}

const sentenceText = (s: Sentence[]) =>
  s
    .map((x) => x.text)
    .join(" ")
    .replace(/\n /g, "\n\n")
    .trim();

function equationsOf(lines: Line[]): ChunkEquation[] {
  return lines.flatMap((l) => {
    const d = detectEquation(l.text);
    return d.isEquation ? [{ latex: l.text.trim().replace(/\s*\(\d+(\.\d+)*[a-z]?\)\s*$/, ""), page: l.page, ...(d.label ? { label: d.label } : {}) }] : [];
  });
}

export function prefixFor(title: string, section: string | null, pageStart: number, pageEnd: number) {
  const pages = pageStart === pageEnd ? `p.${pageStart}` : `p.${pageStart}-${pageEnd}`;
  return `[${title} | ${section ?? "Front matter"} | ${pages}] `;
}

export class ChunkLimitError extends Error {
  readonly fault = "file" as const;
  constructor() {
    super(`This PDF is too long to index (more than ${MAX_CHUNKS} passages). Split it into smaller parts.`);
    this.name = "ChunkLimitError";
  }
}

/** A piece before merging: one atomic unit or one packed group of prose sentences. */
interface Block {
  type: ChunkType;
  section: string | null;
  scope: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  tokens: number;
  equations: ChunkEquation[];
  /** Prose groups: their sentences (the carried overlap is shared by identity). */
  sentences?: Sentence[];
}

/** A merged passage takes the most specific type it contains (equation passages get neighbour expansion). */
const TYPE_RANK: ChunkType[] = ["worked_example", "equation", "table", "definition", "summary", "prose"];

/** "Ch 1 › 1.5 Units › Prefixes" and "Ch 1 › 1.5 Units" → "Ch 1 › 1.5 Units". */
function commonSection(a: string | null, b: string | null) {
  if (a === b) return a;
  if (!a || !b) return a ?? b;
  const x = a.split(" › ");
  const y = b.split(" › ");
  const out: string[] = [];
  for (let i = 0; i < Math.min(x.length, y.length) && x[i] === y[i]; i++) out.push(x[i]!);
  return out.length ? out.join(" › ") : null;
}

/**
 * Merge small neighbours (RAG_PIPELINE.md §3): a piece under MIN_TOKENS joins the passage before
 * it when both share chapter + section, the pages are adjacent and the result stays near the
 * target size; a TINY piece (a lone heading) may join the passage after it across a section
 * boundary. When two prose groups of the same paragraph run merge, their carried overlap is not
 * repeated.
 */
export function mergeSmall(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const acc = out.at(-1);
    if (!acc || b.pageStart - acc.pageEnd > 1) {
      out.push({ ...b });
      continue;
    }
    // Sentences b shares with acc (the overlap carried between prose groups).
    let shared = 0;
    if (acc.sentences && b.sentences) while (shared < b.sentences.length && acc.sentences.includes(b.sentences[shared]!)) shared++;
    const rest = b.sentences && shared ? b.sentences.slice(shared) : null;
    if (rest && !rest.length) continue; // nothing new beyond the overlap
    const addContent = rest ? sentenceText(rest) : b.content;
    const addTokens = rest ? estimateTokens(addContent) : b.tokens;
    const combined = acc.tokens + addTokens;
    // Across a section boundary only forwards and on the same page: a lone heading joins the
    // text after it, never the end of the previous section (and a short credits page stays apart
    // from chapter 1).
    const tiny =
      (acc.tokens < TINY_TOKENS && (acc.scope === b.scope || acc.pageEnd === b.pageStart)) ||
      (b.tokens < TINY_TOKENS && acc.scope === b.scope);
    const small = acc.tokens < MIN_TOKENS || (b.tokens < MIN_TOKENS && combined <= TARGET_TOKENS * 1.25);
    if (combined > MAX_TOKENS || !(tiny || (acc.scope === b.scope && small))) {
      out.push({ ...b });
      continue;
    }
    const bigger = addTokens > acc.tokens ? b : acc;
    acc.section = acc.scope === b.scope ? commonSection(acc.section, b.section) : bigger.section;
    acc.scope = bigger.scope;
    acc.type = TYPE_RANK.indexOf(acc.type) <= TYPE_RANK.indexOf(b.type) ? acc.type : b.type;
    acc.content = `${acc.content}\n\n${addContent}`;
    acc.tokens = estimateTokens(acc.content);
    acc.pageEnd = Math.max(acc.pageEnd, b.pageEnd);
    acc.equations = [...acc.equations, ...b.equations];
    acc.sentences = b.sentences ? [...(acc.sentences ?? []), ...b.sentences] : acc.sentences;
  }
  return out;
}

/** Pages (display text) → ordered chunk drafts. */
export function splitDocument(title: string, pages: PageText[], maxChunks = MAX_CHUNKS): ChunkDraft[] {
  const blocks: Block[] = [];
  for (const unit of toUnits(pages)) {
    const pageStart = unit.lines[0]!.page;
    const pageEnd = unit.lines.at(-1)!.page;
    const text = joinLines(unit.lines);
    const atomic = unit.type !== "prose" && unit.type !== "summary";
    const base = { type: unit.type, section: unit.section, scope: unit.scope };
    if (atomic && estimateTokens(text) <= ATOMIC_MAX_TOKENS) {
      if (text) blocks.push({ ...base, pageStart, pageEnd, content: text, tokens: estimateTokens(text), equations: equationsOf(unit.lines) });
      continue;
    }
    for (const group of packProse(sentences(unit.lines))) {
      const content = sentenceText(group);
      if (!content) continue;
      const lines = unit.lines.filter((l) => content.includes(l.text.trim()) && l.text.trim());
      blocks.push({
        ...base,
        pageStart: group[0]!.pageStart,
        pageEnd: group.at(-1)!.pageEnd,
        content,
        tokens: estimateTokens(content),
        equations: equationsOf(lines),
        sentences: group,
      });
    }
  }

  const merged = mergeSmall(blocks);
  if (merged.length > maxChunks) throw new ChunkLimitError();
  return merged.map((b, chunkIndex) => ({
    chunkIndex,
    chunkType: b.type,
    sectionPath: b.section,
    pageStart: b.pageStart,
    pageEnd: b.pageEnd,
    content: b.content,
    searchText: prefixFor(title, b.section, b.pageStart, b.pageEnd) + toSearchText(b.content),
    equations: b.equations,
    tokenCount: estimateTokens(b.content),
  }));
}

const CREDITS = /\b(written|edited|translated|compiled|prepared|published|illustrated|reviewed)\s+by\b|\b(authors?|editors?|copyright|isbn)\b|©/i;
export const OVERVIEW_SECTION = "About this document";

/**
 * One extra passage that describes the document itself: the title page and credits (who wrote,
 * edited, translated and published it) and the chapters with their pages. Questions such as
 * "who wrote this book?" or "what chapters does it have?" have no other good match: the credits
 * page says "Written by", not "author", and the chapter list is spread over the whole book.
 * Built only from the document's own text; skipped when there are no credits and fewer than two
 * chapters (a single chapter or set of notes).
 */
export function overviewChunk(title: string, pageCount: number, pages: PageText[], drafts: ChunkDraft[]): ChunkDraft | null {
  const chapters: { name: string; from: number; to: number }[] = [];
  for (const d of drafts) {
    const ch = d.sectionPath?.split(" › ")[0];
    if (!ch?.startsWith("Ch ")) continue;
    const last = chapters.at(-1);
    if (last?.name === ch) last.to = Math.max(last.to, d.pageEnd);
    else if (!chapters.some((c) => c.name === ch)) chapters.push({ name: ch, from: d.pageStart, to: d.pageEnd });
  }
  const firstChapterPage = chapters[0]?.from ?? Infinity;
  const credits = pages.filter((p) => p.page < firstChapterPage && p.page <= 12 && CREDITS.test(p.text)).slice(0, 3);
  if (!credits.length && chapters.length < 2) return null;

  const parts = [`About this document: "${title}", a PDF of ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`];
  if (credits.length) {
    let text = credits.map((p) => p.text.trim()).join("\n\n");
    const words = text.split(/(\s+)/);
    if (estimateTokens(text) > 350) text = `${words.slice(0, 520).join("").trim()}…`;
    const from = credits[0]!.page;
    const to = credits.at(-1)!.page;
    parts.push(`Title page and credits (who wrote, edited, translated and published it; the authors), ${from === to ? `page ${from}` : `pages ${from}-${to}`}:\n${text}`);
  }
  if (chapters.length) parts.push(`Chapters in this document (contents, with PDF pages):\n${chapters.map((c) => `${c.name}: pages ${c.from}-${c.to}`).join("\n")}`);
  const content = parts.join("\n\n");
  const pageStart = credits[0]?.page ?? pages[0]?.page ?? 1;
  const pageEnd = credits.at(-1)?.page ?? pageStart;
  return {
    chunkIndex: drafts.length,
    chunkType: "summary",
    sectionPath: OVERVIEW_SECTION,
    pageStart,
    pageEnd,
    content,
    searchText: prefixFor(title, OVERVIEW_SECTION, pageStart, pageEnd) + toSearchText(content),
    equations: [],
    tokenCount: estimateTokens(content),
  };
}
