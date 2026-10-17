"use client";

import { ErrorState } from "@/components/shell/ErrorState";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main">
      <ErrorState reset={reset} digest={error.digest} />
    </main>
  );
}
