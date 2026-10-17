"use client";

import { ArrowUp, Square } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MAX_MESSAGE_CHARS } from "@/shared/ui-message";

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  disabled?: boolean;
  disabledReason?: string;
  footer?: React.ReactNode;
}

const COUNTER_FROM = MAX_MESSAGE_CHARS - 500;

/** Auto-growing message box: Enter sends, Shift+Enter adds a line, Stop while streaming. */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, onChange, onSend, onStop, busy, disabled = false, disabledReason, footer },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const length = value.length;
  const over = length > MAX_MESSAGE_CHARS;
  const canSend = !busy && !disabled && value.trim().length > 0 && !over;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[820px]" data-testid="composer">
      <div
        className={cn(
          "border-border bg-surface shadow-glow relative flex items-end gap-2 rounded-[var(--radius-md)] border p-2 transition-shadow focus-within:border-[color-mix(in_oklch,var(--field)_60%,transparent)] focus-within:shadow-[0_0_0_1px_var(--field),0_10px_40px_-14px_var(--field)]",
          disabled && "opacity-70",
        )}
      >
        <label htmlFor="composer-input" className="sr-only">
          Ask a physics question
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? (disabledReason ?? "") : "Ask a physics question…"}
          aria-describedby="composer-hint"
          aria-invalid={over || undefined}
          className="text-text placeholder:text-muted max-h-[220px] min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 leading-6 outline-none"
        />
        {busy ? (
          <Button
            variant="secondary"
            size="icon"
            onClick={onStop}
            aria-label="Stop generating"
            data-testid="stop-button"
          >
            <Square className="size-4 fill-current" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="icon"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            data-testid="send-button"
          >
            <ArrowUp className="size-5" aria-hidden />
          </Button>
        )}
      </div>
      <div
        id="composer-hint"
        className="text-muted mt-1.5 flex min-h-5 items-center justify-between gap-3 px-1 text-xs"
      >
        <span className="truncate">{footer}</span>
        {length >= COUNTER_FROM && (
          <span
            data-testid="char-counter"
            className={cn("shrink-0 tabular-nums", over && "text-danger font-medium")}
          >
            {length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
            {over && " (too long)"}
          </span>
        )}
      </div>
    </div>
  );
});
