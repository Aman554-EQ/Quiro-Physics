import "server-only";

/**
 * Heading tree (RAG_PIPELINE.md §3.1): `Chapter N Title` (digits or words: "Chapter Two"),
 * `N.M Title`, `N.M.K Title`, short ALL-CAPS lines and Title Case subheadings. The section path
 * reads "Ch 3 Motion in Two Dimensions › 3.4 Projectile Motion".
 */
export interface Heading {
  level: 1 | 2 | 3;
  label: string;
  /** A chapter line without a title ("Chapter Two"): the title is on the next line. */
  needsTitle?: boolean;
}

const NUMBER_WORDS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

const titleLike = (t: string) =>
  t.length >= 2 && t.length <= 80 && !/[=;]/.test(t) && !/[.:,]$/.test(t) && /^[A-Z(]/.test(t) && !/\d+\s*(m|s|kg|N|J)\b/.test(t);

const isAllCaps = (t: string) => {
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length >= 6 && letters === letters.toUpperCase() && t.split(" ").length <= 8 && !/[=]/.test(t);
};

/** "PHYSICAL QUANTITIES AND MEASUREMENT" → "Physical quantities and measurement". */
export const sentenceCase = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/** A line that reads like running text: a Title Case line followed by it is a real subheading. */
export function isProseLine(line: string) {
  const t = line.trim();
  if (/[=]/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  const alpha = words.filter((w) => /^[\p{L}'’(),.;:-]+$/u.test(w)).length;
  return alpha / words.length >= 0.6;
}

/**
 * `next` is the next non-empty line (when known). A Title Case line only counts as a heading when
 * running text follows it: "Written by" (names follow) and table headers ("Factor Symbol Example",
 * rows follow) are not headings, otherwise every credit line and table became its own section.
 */
export function detectHeading(line: string, next?: string): Heading | null {
  const t = line.trim().replace(/\s+/g, " ");
  if (!t || t.length > 90) return null;
  const chapter = t.match(new RegExp(String.raw`^chapter\s+(\d+|${NUMBER_WORDS.join("|")})\b[:.]?\s*(.*)$`, "i"));
  if (chapter) {
    const n = /^\d+$/.test(chapter[1]!) ? chapter[1]! : String(NUMBER_WORDS.indexOf(chapter[1]!.toLowerCase()) + 1);
    const title = chapter[2]!.trim();
    // "Chapter Subject Page No" (a contents table header) is not a chapter.
    if (title && !/^\d+$/.test(chapter[1]!) && !isAllCaps(title) && !titleLike(title)) return null;
    return title
      ? { level: 1, label: `Ch ${n} ${isAllCaps(title) ? sentenceCase(title) : title}` }
      : { level: 1, label: `Ch ${n}`, needsTitle: true };
  }
  const numbered = t.replace(/\s*:$/, "").match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?\s+(.+)$/);
  if (numbered && titleLike(numbered[4]!) && (numbered[4]!.match(/\s/g)?.length ?? 0) < 10)
    return { level: numbered[3] ? 3 : 2, label: t.replace(/\s*:$/, "") };
  if (isAllCaps(t)) return { level: 3, label: sentenceCase(t) };
  // Title Case subheading: "The Range Equation", "Time of Flight and Maximum Height".
  const words = t.split(" ");
  if (
    words.length >= 2 &&
    words.length <= 7 &&
    !/[\d=:;,.!?()/]/.test(t) &&
    words.every((w) => w.length < 4 || /^[A-Z]/.test(w)) &&
    /^[A-Z]/.test(t) &&
    (next === undefined || isProseLine(next))
  )
    return { level: 3, label: t };
  return null;
}

/** The title line after "Chapter Two": ALL CAPS ("FORCE") or Title Case, short, not a sentence. */
export function chapterTitle(line: string): string | null {
  const t = line.trim().replace(/\s+/g, " ");
  if (!t || t.length > 80 || /[.!?]$/.test(t)) return null;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase() && t.split(" ").length <= 10) return sentenceCase(t);
  return titleLike(t) && t.split(" ").length <= 10 ? t : null;
}

/** "Chapter foru" (a typo in a real book) followed by an ALL CAPS title: the next chapter. */
export const looseChapter = (line: string) => /^chapter\s+[a-z]+$/i.test(line.trim());

/** Keeps the current Chapter › Section › Subsection path while walking the lines. */
export class SectionTracker {
  private stack: (string | null)[] = [null, null, null];
  enter(h: Heading) {
    this.stack[h.level - 1] = h.label;
    for (let i = h.level; i < 3; i++) this.stack[i] = null;
  }
  get path(): string | null {
    const parts = this.stack.filter(Boolean) as string[];
    return parts.length ? parts.join(" › ") : null;
  }
  /** Chapter + section (levels 1 and 2): passages of useful size never merge across it. */
  get scope(): string {
    return `${this.stack[0] ?? ""}|${this.stack[1] ?? ""}`;
  }
}
