import { ClerkProvider } from "@clerk/nextjs";

import { isClerkConfigured } from "@/server/auth/session";

/** Clerk's theme follows the app's colour tokens, so sign-in matches both themes. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--field)",
    colorBackground: "var(--surface)",
    colorText: "var(--text)",
    colorTextSecondary: "var(--muted)",
    colorInputBackground: "var(--surface-2)",
    colorInputText: "var(--text)",
    colorDanger: "var(--danger)",
    fontFamily: "var(--font-body), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "10px",
  },
};

/**
 * Wraps app pages in ClerkProvider only when Clerk is configured. It is not in the root layout,
 * so the landing page never loads Clerk's JavaScript.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;
  return (
    <ClerkProvider appearance={clerkAppearance} signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}
