import "server-only";

import { createEnv } from "@t3-oss/env-nextjs";

import { assertNoTestAuthOnVercel, clientShape, formatEnvIssues, serverShape } from "@/config/env-schema";

assertNoTestAuthOnVercel(process.env);

/**
 * Typed, validated environment for server code. Import `env` — never read
 * `process.env` directly in application code.
 */
export const env = createEnv({
  server: serverShape,
  client: clientShape,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  onValidationError: (issues) => {
    throw new Error(
      formatEnvIssues(
        issues.map((i) => ({
          path: (i.path ?? []).map((p) => (typeof p === "object" ? p.key : p)),
          message: i.message,
        })),
      ),
    );
  },
});
