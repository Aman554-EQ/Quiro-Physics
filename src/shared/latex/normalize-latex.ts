/**
 * Normalise model Markdown so remark-math renders it reliably (documentation/EQUATIONS.md §3).
 * Shared by client (rendering) and server (persistence). Pure and idempotent.
 *
 *  - code fences and inline code are never touched
 *  - \( … \) → $…$,  \[ … \] → display $$ block  (but `\\[4pt]` line breaks are left alone)
 *  - currency "$5" → "\$5"  (while "$2x$" and "$2 + 3 = 5$" stay maths)
 *  - $$$ → $$,  "$ x $" → "$x$"
 *  - one-line $$x$$ inside prose → its own display block
 *  - at most one blank line in a row
 */

export type Segment = { code: boolean; text: string };

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Split into prose / code segments (fenced blocks, then inline code spans). Concatenation === input. */
export function splitCode(md: string): Segment[] {
  const out: Segment[] = [];
  const lines = md.split("\n");
  let prose = "";
  let fence: string | null = null;
  const flushProse = () => {
    if (prose) out.push(...splitInlineCode(prose));
    prose = "";
  };
  lines.forEach((raw, i) => {
    const line = i < lines.length - 1 ? `${raw}\n` : raw;
    const m = FENCE.exec(raw);
    if (fence === null) {
      if (m) {
        flushProse();
        fence = m[1]!;
        out.push({ code: true, text: line });
      } else prose += line;
    } else {
      out.push({ code: true, text: line });
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length && raw.trim() === m[1]) fence = null;
    }
  });
  flushProse();
  return mergeAdjacent(out);
}

function splitInlineCode(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ code: false, text: text.slice(last, m.index) });
    out.push({ code: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ code: false, text: text.slice(last) });
  return out;
}

function mergeAdjacent(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const prev = out.at(-1);
    if (prev && prev.code === s.code) prev.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** "$5", "$3.50", "$1,000" followed by a word, punctuation or the end — but not by a maths operator. */
const CURRENCY =
  /(?<![\\$])\$(\d[\d,]*(?:\.\d+)?)(?![\d.,]*\d)(?=[\s.,;:!?)\]]|$)(?![ \t]*[+\-=*/^_\\{}<>|])/g;
/** Same rule, not global: does a string start with something the currency rule would escape? */
const CURRENCY_AT_START = new RegExp(CURRENCY.source);
// `(?![\d.,]*\d)` stops backtracking: "$35.3\ \text{m}$" must not be read as "$35" + ".3…"
// Bracket delimiters never span existing $-maths (keeps the transform idempotent).
const DISPLAY_BRACKETS = /(?<!\\)\\\[([^$]*?)(?<!\\)\\\]/g;
const INLINE_PARENS = /(?<!\\)\\\(([^$\n]*?)(?<!\\)\\\)/g;
const ONE_LINE_DISPLAY = /\$\$([^$\n]+?)\$\$/g;
/** An unescaped single `$` (not part of `$$`). */
const SINGLE_DOLLAR = /(?<![\\$])\$(?!\$)/g;

const block = (latex: string) => `\n\n$$\n${latex.trim()}\n$$\n\n`;

/**
 * Trim padding inside inline maths ("$ x $" → "$x$"). Delimiters are paired left to right on
 * each line, so the text *between* two spans ("$a$ with $b$") is never mistaken for maths.
 */
function trimInlineMath(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const marks = [...line.matchAll(SINGLE_DOLLAR)].map((m) => m.index!);
      if (marks.length < 2) return line;
      let out = "";
      let last = 0;
      for (let i = 0; i + 1 < marks.length; i += 2) {
        const open = marks[i]!;
        const close = marks[i + 1]!;
        const inner = line.slice(open + 1, close);
        let trimmed = inner.trim();
        // "$ 1.$" must not become "$1.$": the next pass would read that as currency (idempotence).
        if (CURRENCY_AT_START.exec(`$${trimmed}$${line.slice(close + 1)}`)?.index === 0) trimmed = inner.trimEnd();
        const ok = trimmed && !trimmed.endsWith("\\") && !inner.includes("$");
        out += line.slice(last, open) + "$" + (ok ? trimmed : inner) + "$";
        last = close + 1;
      }
      return out + line.slice(last);
    })
    .join("\n");
}

function normalizeProse(text: string): string {
  const t = text
    .replace(DISPLAY_BRACKETS, (_, m: string) => block(m))
    .replace(INLINE_PARENS, (_, m: string) => `$${m.trim()}$`)
    .replace(/\${3,}/g, "$$$$")
    // Display blocks before currency, so "$1" is judged on the final layout (idempotence: "$1$$x$$").
    .replace(ONE_LINE_DISPLAY, (_, m: string) => block(m))
    .replace(CURRENCY, "\\$$$1");
  return trimInlineMath(t).replace(/\n{3,}/g, "\n\n");
}

export function normalizeLatex(md: string): string {
  if (!md) return md;
  return splitCode(md)
    .map((s) => (s.code ? s.text : normalizeProse(s.text)))
    .join("");
}

export interface MathSpan {
  latex: string;
  display: boolean;
}

/** Extract maths spans from Markdown (normalised first), skipping code. */
export function extractMathSpans(md: string): MathSpan[] {
  const spans: MathSpan[] = [];
  for (const seg of splitCode(normalizeLatex(md))) {
    if (seg.code) continue;
    const rest = seg.text.replace(/\$\$([\s\S]*?)\$\$/g, (_, m: string) => {
      spans.push({ latex: m.trim(), display: true });
      return " ";
    });
    rest.replace(/(?<![\\$])\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/g, (_, m: string) => {
      spans.push({ latex: m.trim(), display: false });
      return " ";
    });
  }
  return spans;
}

/**
 * While streaming, hide a trailing inline `$…` that hasn't closed yet, so half an
 * expression never flashes as raw text. Returns the visible part.
 */
export function hideDanglingInlineMath(md: string): string {
  const segs = splitCode(md);
  const last = segs.at(-1);
  if (!last || last.code) return md;
  const lineStart = last.text.lastIndexOf("\n") + 1;
  const line = last.text.slice(lineStart);
  const singles = [...line.matchAll(/(?<![\\$])\$(?!\$)/g)];
  if (singles.length % 2 === 1) {
    const cut = singles.at(-1)!.index!;
    last.text = last.text.slice(0, lineStart + cut).replace(/[ \t]+$/, " ");
    return segs.map((s) => s.text).join("");
  }
  return md;
}

/** True when the text ends inside an unterminated display block ($$ opened but not closed). */
export function endsInsideDisplayMath(md: string): boolean {
  let open = false;
  for (const seg of splitCode(md)) {
    if (seg.code) continue;
    const count = (seg.text.match(/\$\$/g) ?? []).length;
    if (count % 2 === 1) open = !open;
  }
  return open;
}
