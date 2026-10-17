import type { KatexOptions } from "katex";

/**
 * KaTeX settings used everywhere (EQUATIONS.md §4).
 * trust:false blocks \href, \url, \htmlClass…; maxExpand stops macro bombs; maxSize caps \rule.
 */
export const KATEX_OPTIONS = {
  throwOnError: false,
  strict: "ignore",
  trust: false,
  maxSize: 10,
  maxExpand: 1000,
  output: "htmlAndMathml",
} as const satisfies KatexOptions;
