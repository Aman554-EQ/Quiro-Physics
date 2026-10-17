import "katex/dist/katex.min.css";

import { notFound } from "next/navigation";

import { Providers } from "@/components/providers";
import { isDevPagesEnabled } from "@/config/dev-pages";

export const dynamic = "force-dynamic";

/** Dev-only pages: 404 on a normal production deployment. */
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (!isDevPagesEnabled()) notFound();
  return (
    <Providers>
      <div className="min-h-dvh">{children}</div>
    </Providers>
  );
}
