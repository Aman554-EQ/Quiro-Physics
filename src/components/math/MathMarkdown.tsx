"use client";

import remarkMath from "remark-math";
import { parseMarkdownIntoBlocks, Streamdown, type Components, type PluginConfig } from "streamdown";
import { memo, useMemo } from "react";

import { cn } from "@/lib/cn";
import {
  endsInsideDisplayMath,
  hideDanglingInlineMath,
  normalizeLatex,
} from "@/shared/latex/normalize-latex";

import { EquationCard, EquationForming, MathFallback } from "./EquationCard";
import { rehypePhysicsMath } from "./rehype-physics-math";

/** Module-level constants so Streamdown's processor cache is hit on every render. */
const PLUGINS: PluginConfig = {
  math: {
    name: "katex",
    type: "math",
    remarkPlugin: [remarkMath, { singleDollarTextMath: true }],
    rehypePlugin: rehypePhysicsMath,
  },
};
const REMEND = { katex: false, inlineKatex: false } as const;

type Extra = { node?: unknown; children?: React.ReactNode } & Record<string, unknown>;

const COMPONENTS = {
  "equation-card": ({ children, ...props }: Extra) => (
    <EquationCard latex={String(props["data-latex"] ?? "")}>{children}</EquationCard>
  ),
  "math-fallback": (props: Extra) => <MathFallback latex={String(props["data-latex"] ?? "")} />,
  // No images from model output (tracking pixels, broken links): show the alt text instead.
  img: (props: Extra) => <span className="text-muted">[{String(props.alt ?? "image")}]</span>,
} as unknown as Components;

interface BlockProps {
  content: string;
  index: number;
  live: boolean;
  onRender?: (index: number) => void;
}

const MathBlock = memo(
  function MathBlock({ content, index, live, onRender }: BlockProps) {
    onRender?.(index);
    return (
      <Streamdown
        mode="static"
        parseIncompleteMarkdown={live}
        remend={REMEND}
        plugins={PLUGINS}
        components={COMPONENTS}
        skipHtml
        controls={false}
        lineNumbers={false}
        className="physics-md"
      >
        {content}
      </Streamdown>
    );
  },
  (a, b) => a.content === b.content && a.live === b.live && a.index === b.index,
);

export interface MathMarkdownProps {
  content: string;
  /** True while tokens are still arriving */
  streaming?: boolean;
  className?: string;
  /** Test hook: called whenever a block actually re-renders */
  onBlockRender?: (index: number) => void;
}

/**
 * Markdown + LaTeX renderer that is safe to feed a token stream:
 * finished blocks are memoised (rendered once); only the trailing block re-renders;
 * an unterminated $$ block shows an "equation forming…" placeholder instead of broken maths.
 */
export function MathMarkdown({ content, streaming = false, className, onBlockRender }: MathMarkdownProps) {
  const { blocks, forming } = useMemo(() => {
    let text = normalizeLatex(content);
    let forming = false;
    if (streaming) {
      if (endsInsideDisplayMath(text)) {
        forming = true;
        text = text.slice(0, text.lastIndexOf("$$"));
      }
      text = hideDanglingInlineMath(text);
    }
    return { blocks: parseMarkdownIntoBlocks(text).filter((b) => b.trim() !== ""), forming };
  }, [content, streaming]);

  return (
    <div className={cn("physics-prose", className)} data-testid="math-markdown">
      {blocks.map((block, i) => (
        <MathBlock
          key={i}
          index={i}
          content={block}
          live={streaming && i === blocks.length - 1}
          onRender={onBlockRender}
        />
      ))}
      {forming && <EquationForming />}
    </div>
  );
}
