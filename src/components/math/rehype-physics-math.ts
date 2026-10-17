import rehypeKatex from "rehype-katex";

import { KATEX_OPTIONS } from "@/shared/latex/katex-options";

/* Minimal hast types (avoid a direct dependency on @types/hast). */
interface HText {
  type: "text";
  value: string;
}
interface HElement {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HNode[];
}
type HNode = HText | HElement | { type: string; children?: HNode[] };
interface HRoot {
  type: "root";
  children: HNode[];
}

const isElement = (n: HNode): n is HElement => n.type === "element";
const classes = (n: HElement): string[] => {
  const c = n.properties?.className;
  return Array.isArray(c) ? c.map(String) : typeof c === "string" ? c.split(/\s+/) : [];
};
const textOf = (n: HNode): string =>
  n.type === "text"
    ? (n as HText).value
    : "children" in n && n.children
      ? n.children.map(textOf).join("")
      : "";

/** Depth-first walk. A visitor that replaces the node returns `true`, and the replacement isn't descended. */
function walk(
  parent: { children: HNode[] },
  visit: (node: HElement, index: number, parent: { children: HNode[] }) => boolean | void,
) {
  for (let i = 0; i < parent.children.length; i++) {
    const node = parent.children[i]!;
    if (!isElement(node)) continue;
    if (visit(node, i, parent) === true) continue;
    walk(node, visit);
  }
}

/**
 * Display maths from remark-math is <pre><code class="language-math math-display">. Streamdown's
 * sanitiser runs before this plugin and keeps only `language-*` classes, so — like rehype-katex
 * itself — treat `pre > code.language-math` as display maths.
 */
function isDisplayMath(n: HElement) {
  if (n.tagName !== "pre") return false;
  const code = n.children.find(isElement);
  return !!code && code.tagName === "code" && classes(code).includes("language-math");
}

/**
 * rehype plugin = rehype-katex with two physics-tutor additions:
 *  1. display equations are wrapped in <equation-card data-latex="…"> (copy LaTeX, horizontal scroll)
 *  2. KaTeX error spans become <math-fallback data-latex="…"> (no red error text for learners)
 */
export function rehypePhysicsMath(this: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const katexTransform = (rehypeKatex as any).call(this, KATEX_OPTIONS) as (
    tree: HRoot,
    file: unknown,
  ) => void;

  return (tree: HRoot, file: unknown) => {
    walk(tree, (node, index, parent) => {
      if (isDisplayMath(node)) {
        parent.children[index] = {
          type: "element",
          tagName: "equation-card",
          properties: { dataLatex: textOf(node).trim() },
          children: [node],
        };
        return true;
      }
    });

    katexTransform(tree, file);

    walk(tree, (node, index, parent) => {
      if (classes(node).includes("katex-error")) {
        parent.children[index] = {
          type: "element",
          tagName: "math-fallback",
          properties: { dataLatex: textOf(node) },
          children: [{ type: "text", value: textOf(node) }],
        };
        return true;
      }
    });
  };
}
