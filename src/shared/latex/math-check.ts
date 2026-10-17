import katex from "katex";

import { KATEX_OPTIONS } from "./katex-options";
import { extractMathSpans } from "./normalize-latex";

/**
 * Server-side maths check at the end of an answer (EQUATIONS.md §5):
 * counts maths spans KaTeX cannot parse. Not a blocker — stored as `messages.math_parse_errors`.
 */
export function countMathErrors(markdown: string): number {
  let errors = 0;
  for (const span of extractMathSpans(markdown)) {
    try {
      katex.renderToString(span.latex, { ...KATEX_OPTIONS, displayMode: span.display, throwOnError: true });
    } catch {
      errors++;
    }
  }
  return errors;
}
