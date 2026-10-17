import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";

import { Magnet } from "@/components/physics/illustrations";
import { Wordmark } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button-variants";
import { isClerkConfigured } from "@/server/auth/session";

/** Why the visitor is being asked to sign in, from the page they tried to open. */
export function reasonFor(redirectUrl: string | undefined) {
  const path = redirectUrl?.split("?")[0] ?? "";
  if (path.startsWith("/history")) return "Sign in to see your saved chats.";
  if (path.startsWith("/library")) return "Sign in to upload your textbooks.";
  if (path.startsWith("/settings")) return "Sign in to change your preferences.";
  return "Sign in to save your chats and pick up where you left off.";
}

/** Shared frame for /sign-in and /sign-up: Clerk's form when configured, an honest note otherwise. */
export function AuthPage({ mode, redirectUrl }: { mode: "sign-in" | "sign-up"; redirectUrl?: string }) {
  const configured = isClerkConfigured();
  return (
    <main
      id="main"
      className="doodles flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 text-center"
    >
      <Link href="/" aria-label="Quiro Physics home">
        <Wordmark />
      </Link>
      {configured ? (
        <>
          <p className="text-muted max-w-sm">{reasonFor(redirectUrl)}</p>
          {mode === "sign-in" ? (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/chat" />
          ) : (
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/chat" />
          )}
        </>
      ) : (
        <>
          <Magnet className="h-28 w-auto" />
          <h1 className="text-3xl font-semibold">Accounts aren&apos;t set up here yet</h1>
          <p className="text-muted max-w-md">
            {reasonFor(redirectUrl)} This server has no sign-in service configured, so you can keep asking questions
            as a guest.
          </p>
          <Link href="/chat" className={buttonVariants({ variant: "primary" })}>
            Back to the tutor
          </Link>
        </>
      )}
    </main>
  );
}
