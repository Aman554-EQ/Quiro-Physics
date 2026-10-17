"use client";

import { AlertTriangle, Check, Copy, Play, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { MathMarkdown } from "@/components/math/MathMarkdown";
import { OrbitLoader, PipelineStatus, WavePacketCursor } from "@/components/physics/indicators";
import { getTransition, spring } from "@/components/physics/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";
import { messageSources, messageText, type ChatMessage, type MessagePart } from "@/shared/ui-message";

import { ReasoningBlock } from "./ReasoningBlock";
import { SourcesChips } from "./Sources";

const ROUTE_LABEL: Record<string, string> = {
  concept: "Concept",
  numerical: "Step-by-step solution",
  derivation: "Derivation",
  textbook_lookup: "From your textbook",
  mixed: "Textbook + explanation",
  follow_up: "Follow-up",
};

interface MessageProps {
  message: ChatMessage;
  isLast: boolean;
  onOpenSource: (label: number) => void;
  onRetry?: () => void;
  onContinue?: () => void;
}

export const Message = memo(function Message({ message, isLast, onOpenSource, onRetry, onContinue }: MessageProps) {
  const reduced = useReducedMotion();
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={getTransition(spring.soft, reduced)}
        className="flex justify-end"
        data-role="user"
      >
        <p className="max-w-[85%] rounded-[var(--radius-md)] rounded-br-md border border-[color-mix(in_oklch,var(--field)_30%,transparent)] bg-[color-mix(in_oklch,var(--field)_12%,var(--surface))] px-4 py-2.5 whitespace-pre-wrap">
          {messageText(message)}
        </p>
      </motion.div>
    );
  }
  return (
    <AssistantMessage
      message={message}
      isLast={isLast}
      onOpenSource={onOpenSource}
      onRetry={onRetry}
      onContinue={onContinue}
    />
  );
});

function AssistantMessage({ message, isLast, onOpenSource, onRetry, onContinue }: MessageProps) {
  const reduced = useReducedMotion();
  const streaming = message.status === "streaming";
  const text = messageText(message);
  const reasoning = message.parts.find((p) => p.type === "reasoning") as
    Extract<MessagePart, { type: "reasoning" }> | undefined;
  const route = message.meta?.route;
  const showLoader = streaming && !text && !reasoning;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={getTransition(spring.soft, reduced)}
      aria-busy={streaming}
      data-role="assistant"
      data-status={message.status}
      className="group/msg"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {route && route.scope !== "off_topic" && ROUTE_LABEL[route.queryType] && (
          <span
            className="bg-surface-2 text-muted rounded-full px-2.5 py-0.5 text-[12px]"
            data-testid="route-badge"
          >
            {ROUTE_LABEL[route.queryType]}
            {route.usingTextbook && route.queryType !== "mixed" && route.queryType !== "textbook_lookup" ? " · from your textbook" : ""}
          </span>
        )}
        {streaming && <PipelineStatus stage={message.meta?.stage ?? "observe"} compact />}
        {message.status === "cancelled" && (
          <span
            data-testid="stopped-badge"
            className="border-border text-muted rounded-full border px-2.5 py-0.5 text-[12px]"
          >
            Stopped
          </span>
        )}
        {message.status === "cancelled" && isLast && onContinue && (
          <button
            type="button"
            onClick={onContinue}
            data-testid="continue-answer"
            className="text-field inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[12px] font-medium hover:underline"
          >
            <Play className="size-3.5" aria-hidden /> Continue
          </button>
        )}
      </div>

      {showLoader && <OrbitLoader className="my-1" />}
      {reasoning && (
        <ReasoningBlock text={reasoning.text} active={streaming && !text} durationMs={reasoning.durationMs} />
      )}

      {text && (
        <div className="relative">
          <MathMarkdown content={text} streaming={streaming} />
          {streaming && <WavePacketCursor />}
        </div>
      )}

      {message.status === "error" && (
        <p role="alert" className="text-danger mt-2 flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {message.meta?.error ?? "The answer was interrupted."}
          {onRetry && (
            <button type="button" onClick={onRetry} className="underline underline-offset-2">
              Retry
            </button>
          )}
        </p>
      )}

      <SourcesChips sources={messageSources(message)} onOpen={onOpenSource} />

      {!streaming && text && <MessageActions text={text} onRetry={isLast ? onRetry : undefined} />}
    </motion.article>
  );
}

function MessageActions({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Answer copied (Markdown + LaTeX)");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };
  const btn = "grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text";
  return (
    <div className={cn("mt-2 flex gap-1")} data-testid="message-actions">
      <button type="button" onClick={copy} aria-label="Copy answer" title="Copy answer" className={btn}>
        {copied ? (
          <Check className="text-field size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </button>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Regenerate answer"
          title="Regenerate"
          className={btn}
        >
          <RefreshCw className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
