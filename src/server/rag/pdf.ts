import "server-only";

/**
 * PDF access through unpdf (serverless pdf.js). Page text is rebuilt line by line from the text
 * items (y position / end-of-line flags), which the normaliser and the heading detector need.
 */
export class PdfFileError extends Error {
  /** A problem with the file itself (not refunded, LIMITS_AND_QUOTAS.md §2). */
  readonly fault = "file" as const;
  constructor(message: string) {
    super(message);
    this.name = "PdfFileError";
  }
}

export interface OpenPdf {
  numPages: number;
  pageText(pageNumber: number): Promise<string>;
  destroy(): Promise<void>;
}

interface TextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  height?: number;
  width?: number;
}

const sizeOf = (it: TextItem) => Math.abs(it.transform?.[3] ?? 0) || it.height || 0;

/** `10` + raised `-1` → `10^-1`; `10` + raised `m+n` → `10^(m+n)`; lowered → `_`. */
function scriptText(kind: "sup" | "sub", run: string) {
  const t = run.trim();
  if (!t) return "";
  return `${kind === "sup" ? "^" : "_"}${/^[-+]?[\p{L}\p{N}.]+$/u.test(t) ? t : `(${t})`}`;
}

/**
 * Page text from pdf.js items, line by line. A new line starts when the baseline moves by about
 * half a font size; a smaller item raised or lowered within the line is a superscript or
 * subscript (`10^-6 V`, `v_0`), not a line of its own. Without that, every power of ten became a
 * separate line and a one-token "equation" passage.
 */
export function itemsToText(items: TextItem[]): string {
  const lines: { text: string; y: number | null }[] = [];
  let cur = "";
  let baseY: number | null = null;
  let baseSize = 0;
  let lastEnd: number | null = null;
  let script: { kind: "sup" | "sub"; run: string } | null = null;

  const flushScript = () => {
    if (!script) return;
    cur += scriptText(script.kind, script.run);
    script = null;
  };
  const endLine = () => {
    flushScript();
    if (cur) lines.push({ text: cur, y: baseY });
    cur = "";
    baseY = null;
    baseSize = 0;
    lastEnd = null;
  };

  for (const it of items) {
    if (typeof it.str !== "string") continue;
    const str = it.str;
    if (!str.trim()) {
      // Spaces carry the position of whatever precedes them: keep the space, ignore the position.
      // A space also ends a superscript ("10^n = 10^m").
      flushScript();
      if (str && cur && !cur.endsWith(" ")) cur += " ";
      if (it.hasEOL) endLine();
      continue;
    }
    const y = it.transform?.[5] ?? null;
    const x = it.transform?.[4] ?? null;
    const size = sizeOf(it);
    let kind: "normal" | "sup" | "sub" = "normal";
    if (baseY !== null && y !== null) {
      const dy = y - baseY;
      const ref = Math.max(baseSize, size, 1);
      const smaller = size > 0 && baseSize > 0 && size < 0.85 * baseSize;
      if (smaller && Math.abs(dy) > 0.15 * baseSize && Math.abs(dy) < 0.8 * baseSize) kind = dy > 0 ? "sup" : "sub";
      else if (Math.abs(dy) > 0.5 * ref) endLine();
    }
    if (kind === "normal") {
      const afterScript = script !== null;
      flushScript();
      if (baseY === null && y !== null) {
        baseY = y;
        baseSize = size;
      }
      // Items placed apart without a space between them (table columns), and a unit right after
      // a power ("10^-6" then "V") get a space.
      const gap = x !== null && lastEnd !== null ? x - lastEnd : 0;
      const prev = cur.at(-1) ?? " ";
      if (cur && !/\s/.test(prev) && !/^\s/.test(str) && (gap > 0.2 * Math.max(size, 1) || (afterScript && /^[\p{L}\p{N}=+×÷]/u.test(str))))
        cur += " ";
      cur += str;
    } else {
      if (script && script.kind !== kind) flushScript();
      script ??= { kind, run: "" };
      script.run += str;
    }
    if (x !== null) lastEnd = x + (it.width ?? 0);
    if (it.hasEOL) endLine();
  }
  endLine();
  return withParagraphs(lines)
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A gap clearly larger than the page's usual line spacing is a paragraph break (a blank line):
 * the splitter uses blank lines to end worked examples and to keep paragraphs together.
 */
function withParagraphs(lines: { text: string; y: number | null }[]): string[] {
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1]!.y;
    const b = lines[i]!.y;
    if (a !== null && b !== null && a > b) gaps.push(a - b);
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const out: string[] = [];
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    if (prev && typical > 0 && prev.y !== null && l.y !== null && prev.y - l.y > 1.2 * typical) out.push("");
    out.push(l.text);
  });
  return out;
}

export async function openPdf(bytes: Uint8Array): Promise<OpenPdf> {
  const { getDocumentProxy } = await import("unpdf");
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js may detach the buffer: give it a copy.
    doc = await getDocumentProxy(new Uint8Array(bytes));
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new PdfFileError("This PDF is password-protected. Remove the password and upload it again.");
    if (name === "InvalidPDFException" || name === "FormatError")
      throw new PdfFileError("This file couldn't be read as a PDF.");
    throw err;
  }
  return {
    numPages: doc.numPages,
    async pageText(n: number) {
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        return itemsToText(content.items as TextItem[]);
      } finally {
        page.cleanup();
      }
    },
    destroy: () => doc.loadingTask.destroy(),
  };
}
