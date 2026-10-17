"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

import { Circuit } from "@/components/physics/illustrations";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * Shared body for error.tsx boundaries: what happened + Retry + a way home.
 * Plain <button> (not the Motion `Button`): the root error boundary ships with every page,
 * including the landing page, which must not pull in the Motion library.
 */
export function ErrorState({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <Circuit open className="h-24 w-auto" />
      <h1 className="text-3xl font-semibold">Something broke the circuit</h1>
      <p className="text-muted">
        An unexpected error interrupted this page. Your data is safe, so please try again.
      </p>
      {digest && <p className="text-muted font-mono text-xs">Reference: {digest}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className={buttonVariants({ variant: "primary" })}
          onClick={reset}
          data-testid="error-retry"
        >
          <RotateCcw className="size-4" aria-hidden /> Try again
        </button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
