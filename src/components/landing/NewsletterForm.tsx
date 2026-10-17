"use client";

import { Check, Loader2, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; message: string } | { kind: "error"; message: string };

/** Footer sign-up for the weekly physics email (POST /api/newsletter). No toast library: it ships on the landing page. */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const website = (new FormData(e.currentTarget).get("website") as string | null) ?? "";
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const body = (await res.json().catch(() => null)) as { status?: string; error?: { message?: string } } | null;
      if (!res.ok) throw new Error(body?.error?.message ?? "That didn't work. Please try again.");
      setState({
        kind: "done",
        message: body?.status === "already" ? "You're already on the list. Thanks for reading." : "You're subscribed. Your first issue is on its way.",
      });
      setEmail("");
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message || "That didn't work. Please try again." });
    }
  };

  return (
    <form onSubmit={submit} className="w-full" data-testid="newsletter-form" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <div className="relative flex-1">
          <Mail className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <input
            id="newsletter-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border bg-bg focus-visible:outline-field h-11 w-full rounded-[var(--radius-sm)] border pr-3 pl-9 text-base"
          />
        </div>
        {/* Honeypot: people never see or fill it. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="bg-field text-on-field inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-5 text-[15px] font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {state.kind === "sending" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          Subscribe
        </button>
      </div>
      <p
        aria-live="polite"
        data-testid="newsletter-status"
        className={cn(
          "mt-2 min-h-5 text-[13px]",
          state.kind === "error" ? "text-danger" : state.kind === "done" ? "text-field" : "text-muted",
        )}
      >
        {state.kind === "done" ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5" aria-hidden /> {state.message}
          </span>
        ) : state.kind === "error" ? (
          state.message
        ) : (
          <>
            One email a week. No spam, unsubscribe any time. See our{" "}
            <a href="/privacy" className="text-text inline-block py-1 underline underline-offset-4">
              Privacy policy
            </a>
            .
          </>
        )}
      </p>
    </form>
  );
}
