import Link from "next/link";

import { Apple } from "@/components/physics/illustrations";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <main
      id="main"
      className="doodles flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <Apple className="h-28 w-auto" />
      <p className="text-field font-mono text-sm">404</p>
      <h1 className="text-3xl font-semibold">This page fell out of reach</h1>
      <p className="text-muted max-w-md">
        The link may be broken, or the page may have moved. Gravity is not to blame this time.
      </p>
      <div className="flex gap-2">
        <Link href="/" className={buttonVariants({ variant: "primary" })} data-testid="not-found-home">
          Go home
        </Link>
        <Link href="/chat" className={buttonVariants({ variant: "secondary" })}>
          Ask a question
        </Link>
      </div>
    </main>
  );
}
