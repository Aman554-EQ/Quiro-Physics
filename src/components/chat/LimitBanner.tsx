"use client";

import { LogIn, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import type { Limit } from "@/shared/ui-message";

function at(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

/** What limit was hit, why it exists, and what to do next (LIMITS_AND_QUOTAS.md). */
function explain(limit: Limit, signedIn: boolean) {
  const exhausted = limit.remaining === 0;
  switch (limit.kind) {
    // Guests never see counts: the limit only shows up as an invitation to sign in.
    case "guest_turns":
      return (
        <>
          <strong>Sign in to continue this conversation.</strong> A free account keeps every chat and lets the tutor
          answer from your own textbooks.
        </>
      );
    case "guest_daily":
      return (
        <>
          <strong>Sign in to keep asking.</strong> A free account keeps every chat and lets the tutor answer from your
          own textbooks.
        </>
      );
    case "user_daily":
      return exhausted ? (
        <>
          <strong>You&apos;ve sent {limit.limit} messages in the last 24 hours.</strong> The daily limit keeps the free
          tutor available for everyone{at(limit.resetAt) ? `. You can send more from ${at(limit.resetAt)}` : ""}.
        </>
      ) : (
        <>
          <strong>{limit.remaining}</strong> messages left today{signedIn ? "" : "."}
        </>
      );
    case "rate":
      return <strong>You&apos;re sending messages quickly. Please wait a moment and try again.</strong>;
  }
}

export function LimitBanner({
  limit,
  onNewQuestion,
  signInHref = "/sign-in",
  signedIn = false,
}: {
  limit: Limit;
  onNewQuestion: () => void;
  signInHref?: string;
  signedIn?: boolean;
}) {
  const exhausted = limit.remaining === 0;
  const guestGate = limit.kind === "guest_turns" || limit.kind === "guest_daily";
  const canStartNew = limit.kind === "rate";
  return (
    <div
      role="status"
      data-testid="limit-banner"
      data-kind={limit.kind}
      className={cn(
        "mx-auto mb-3 w-full max-w-[820px] rounded-[var(--radius-md)] border px-4 py-3",
        exhausted
          ? "border-[color-mix(in_oklch,var(--energy)_55%,transparent)] bg-[color-mix(in_oklch,var(--energy)_10%,var(--surface))]"
          : "border-border bg-surface",
      )}
    >
      <p className="text-sm">{explain(limit, signedIn)}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {canStartNew && (
          <Button variant="secondary" size="sm" onClick={onNewQuestion} className="min-h-11 sm:min-h-9">
            <RotateCcw className="size-4" aria-hidden /> New question
          </Button>
        )}
        {!signedIn && (
          <Link
            href={signInHref}
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "min-h-11 sm:min-h-9")}
          >
            <LogIn className="size-4" aria-hidden /> Sign in to continue
          </Link>
        )}
        {!signedIn && guestGate && (
          <Link href="/sign-up" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-11 sm:min-h-9")}>
            Create a free account
          </Link>
        )}
      </div>
    </div>
  );
}
