"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";

import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import type { ChatMessage } from "@/shared/ui-message";

import { Message } from "./Message";

/** Above this many messages the list is virtualised. */
export const VIRTUALIZE_AFTER = 100;

interface MessageListProps {
  messages: ChatMessage[];
  onOpenSource: (label: number) => void;
  onRetry: () => void;
  onContinue?: () => void;
  empty?: React.ReactNode;
}

export function MessageList({ messages, onOpenSource, onRetry, onContinue, empty }: MessageListProps) {
  // Re-pin on every content change (new message or streamed text).
  const last = messages.at(-1);
  const contentKey = `${messages.length}:${last ? JSON.stringify(last.parts).length : 0}:${last?.status}`;
  const { ref, showJump, jumpToLatest } = useStickToBottom<HTMLDivElement>(contentKey);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        data-testid="message-scroll"
        className="h-full overflow-y-auto overscroll-contain px-4 pt-6 pb-4 sm:px-6"
        role="log"
        aria-label="Conversation"
      >
        {messages.length === 0 ? (
          empty
        ) : messages.length > VIRTUALIZE_AFTER ? (
          <VirtualMessages
            messages={messages}
            scrollRef={ref}
            onOpenSource={onOpenSource}
            onRetry={onRetry}
            onContinue={onContinue}
          />
        ) : (
          <div className="mx-auto flex max-w-[820px] flex-col gap-6">
            {messages.map((m, i) => (
              <Message
                key={m.id}
                message={m}
                isLast={i === messages.length - 1}
                onOpenSource={onOpenSource}
                onRetry={onRetry}
              onContinue={onContinue}
              />
            ))}
          </div>
        )}
      </div>
      {showJump && (
        <button
          type="button"
          onClick={jumpToLatest}
          data-testid="jump-to-latest"
          className="border-border bg-surface shadow-glow absolute bottom-3 left-1/2 inline-flex min-h-10 -translate-x-1/2 items-center gap-1.5 rounded-full border px-4 text-sm"
        >
          <ArrowDown className="size-4" aria-hidden /> Jump to latest
        </button>
      )}
    </div>
  );
}

function VirtualMessages({
  messages,
  scrollRef,
  onOpenSource,
  onRetry,
  onContinue,
}: {
  messages: ChatMessage[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onOpenSource: (label: number) => void;
  onRetry: () => void;
  onContinue?: () => void;
}) {
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 180,
    overscan: 6,
    initialRect: { width: 800, height: 800 },
    initialOffset: () => Math.max(0, messages.length * 180 - 800),
  });
  return (
    <div className="relative mx-auto max-w-[820px]" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const m = messages[item.index]!;
        return (
          <div
            key={m.id}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 pb-6"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            <Message
              message={m}
              isLast={item.index === messages.length - 1}
              onOpenSource={onOpenSource}
              onRetry={onRetry}
              onContinue={onContinue}
            />
          </div>
        );
      })}
    </div>
  );
}
