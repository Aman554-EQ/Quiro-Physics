import "server-only";

/**
 * Physics-aware normalisation (RAG_PIPELINE.md §2). Two outputs:
 * - display text (`cleanText`): de-hyphenated, running heads removed, whitespace tidied; never
 *   "corrected" otherwise. Raw page text is stored byte for byte (P3-S3-A13).
 * - search text (`toSearchText`): display text + Greek/symbol word aliases, restored
 *   super/subscripts in equation lines and canonical units, so "omega", "ω" and "\omega" all match.
 */

const SYMBOLS: Record<string, string> = {
  α: "alpha", β: "beta", γ: "gamma", δ: "delta", ε: "epsilon", ζ: "zeta", η: "eta", θ: "theta",
  κ: "kappa", λ: "lambda", μ: "mu", ν: "nu", ξ: "xi", π: "pi", ρ: "rho", σ: "sigma", τ: "tau",
  φ: "phi", χ: "chi", ψ: "psi", ω: "omega", Γ: "Gamma", Δ: "Delta", Θ: "Theta", Λ: "Lambda",
  Π: "Pi", Σ: "Sigma", Φ: "Phi", Ψ: "Psi", Ω: "Omega",
};
const OPERATORS: Record<string, [string, string]> = {
  "∑": ["\\sum", "sum"], "∫": ["\\int", "integral"], "√": ["\\sqrt", "square root"], "∞": ["\\infty", "infinity"],
  "≈": ["\\approx", "approximately"], "≤": ["\\le", "less than or equal"], "≥": ["\\ge", "greater than or equal"],
  "∂": ["\\partial", "partial"], "∇": ["\\nabla", "nabla gradient"], "ħ": ["\\hbar", "hbar reduced planck"],
  "×": ["\\times", "times cross"], "·": ["\\cdot", "dot"], "∝": ["\\propto", "proportional"], "→": ["\\to", "to"],
  "°": ["^\\circ", "degrees"],
};
const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+",
};
const SUBSCRIPTS: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

/** `accel-\neration` → `acceleration` (only between lowercase letters, so "x-\nAxis" stays). */
export function dehyphenate(text: string) {
  return text.replace(/([a-z])-\n([a-z])/g, "$1$2");
}

/**
 * Running heads/feet are short ("4.3 Projectile Motion  83"), so only short lines (≤ 6 words) are
 * compared with their numbers masked; longer lines must repeat exactly to count.
 */
const lineKey = (l: string) => {
  const t = l.trim().replace(/\s+/g, " ").toLowerCase();
  return t.split(" ").length <= 6 ? t.replace(/\d+/g, "#") : t;
};

/** Lines repeated on more than half of the pages (running heads/feet, page numbers). */
export function repeatedLines(pages: string[]): Set<string> {
  const seen = new Map<string, number>();
  for (const p of pages) {
    const keys = new Set(p.split("\n").map(lineKey).filter(Boolean));
    for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const out = new Set<string>();
  if (pages.length < 3) return out;
  for (const [k, n] of seen) if (n > pages.length / 2) out.add(k);
  return out;
}

/** Display text for one page. */
export function cleanText(raw: string, repeated: Set<string> = new Set()) {
  const text = dehyphenate(raw.normalize("NFC").replace(/\r\n?/g, "\n"));
  return text
    .split("\n")
    .filter((l) => {
      const k = lineKey(l);
      if (!k) return true;
      if (repeated.has(k)) return false;
      return !/^#$/.test(k); // a bare page number
    })
    .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- Equations ----------
const RELATION = /[=≈≤≥∝<>]|->|→/;
const EQ_LABEL = /\((\d+(?:\.\d+){1,2}[a-z]?)\)\s*$/;

/** Is this line an equation? Short, has a relation, symbol-dense, or ends with "(3.12)". */
export function detectEquation(line: string): { isEquation: boolean; label?: string } {
  const t = line.trim();
  if (!t || t.length > 120 || !RELATION.test(t)) return { isEquation: false };
  const label = t.match(EQ_LABEL)?.[1];
  const body = t.replace(EQ_LABEL, "").trim();
  const words = body.match(/[A-Za-z]{4,}/g) ?? [];
  const letters = (body.match(/\p{L}/gu) ?? []).length;
  const symbols = (body.match(/[=+\-*/^_()[\]{}≈≤≥∝√∫∑∂∇·×0-9]/g) ?? []).length;
  const prose = words.length > 2 || /[,.;:]\s+\p{L}/u.test(body) || /\.$/.test(body);
  if (label && !prose) return { isEquation: true, label: `(${label})` };
  if (label && words.length <= 4) return { isEquation: true, label: `(${label})` };
  if (prose) return { isEquation: false };
  return { isEquation: body.length <= 80 && symbols >= Math.max(2, letters * 0.3), ...(label ? { label: `(${label})` } : {}) };
}

/** Variable-definition lines bound to the equation above them. */
export const isDefinitionLine = (line: string) => /^\s*(where|here|in which|with)\b/i.test(line);

// ---------- Search text ----------
/** `m/s2`, `m s−2`, `m s^-2`, `m·s⁻²` → `m/s^2` (and the same for any unit over s, s², …). */
export function canonicalUnits(text: string) {
  return text
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+)/g, (m) => `^${[...m].map((c) => SUPERSCRIPTS[c]).join("")}`)
    .replace(/\b(k?g|m|N|J|W|C|V|A)\s*[·*]?\s*s\s*\^?\s*[-−]\s*([123])\b/g, (_m, u: string, p: string) => `${u}/s${p === "1" ? "" : `^${p}`}`)
    .replace(/\b(k?g|m|N|J|W|C|V|A|rad)\/s([23])\b/g, "$1/s^$2")
    .replace(/−/g, "-");
}

/** In equation lines only: `v2 = u2 + 2as` → `v^2 = u^2 + 2as`, `x0` → `x_0`. Never in display text. */
export function restoreScripts(line: string) {
  return line
    .replace(/([₀-₉]+)/g, (m) => `_${[...m].map((c) => SUBSCRIPTS[c]).join("")}`)
    .replace(/\b([a-zA-Z])([23])\b(?!\s*[a-zA-Z(])/g, "$1^$2")
    .replace(/\b([a-zA-Z])0\b/g, "$1_0");
}

export function symbolAliases(text: string) {
  let out = text;
  for (const [sym, word] of Object.entries(SYMBOLS)) out = out.replaceAll(sym, `${sym} (\\${word}, ${word})`);
  for (const [sym, [latex, word]] of Object.entries(OPERATORS)) out = out.replaceAll(sym, `${sym} (${latex}, ${word})`);
  return out;
}

export function toSearchText(display: string) {
  const lines = display.split("\n").map((l) => (detectEquation(l).isEquation ? restoreScripts(l) : l));
  return symbolAliases(canonicalUnits(lines.join("\n").normalize("NFKC")));
}
