import "server-only";

/**
 * Token estimate without a tokenizer download: ~4 characters per token for English prose, with
 * LaTeX and code slightly denser. Used for budgets, so it errs on the high side.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const symbols = (text.match(/[\\{}$^_]/g) ?? []).length;
  return Math.ceil(text.length / 4 + symbols / 4);
}

/** Trim text to at most `maxTokens` (by the same estimate), cutting at a word boundary. */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (estimateTokens(text.slice(0, mid)) <= maxTokens - 1) lo = mid;
    else hi = mid - 1;
  }
  const cut = text.slice(0, lo);
  const space = cut.lastIndexOf(" ");
  return `${space > lo * 0.6 ? cut.slice(0, space) : cut}…`;
}
