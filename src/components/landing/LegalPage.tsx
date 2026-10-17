import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Wordmark } from "@/components/ui/brand";

import { IntentLink } from "./IntentLink";
import { SiteFooter } from "./SiteFooter";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Privacy policy and terms: site header, a table of contents, readable sections, the site footer. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="bg-bg min-h-dvh">
      <header
        className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <IntentLink href="/" aria-label="Quiro Physics home" className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-sm)]">
          <Wordmark />
        </IntentLink>
        <nav aria-label="Site" className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <IntentLink
            href="/chat"
            aria-label="Open the tutor"
            className="text-muted hover:text-text inline-flex min-h-11 items-center rounded-md px-2 text-[15px] whitespace-nowrap min-[400px]:px-3"
          >
            <span className="min-[400px]:hidden">Tutor</span>
            <span className="hidden min-[400px]:inline">Open the tutor</span>
          </IntentLink>
          <ThemeToggle />
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-6 flex flex-col gap-1 text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-muted hover:text-text inline-flex min-h-8 items-center">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="max-w-[720px]">
            <h1 className="font-display text-[clamp(2rem,5vw,2.75rem)] font-semibold">{title}</h1>
            <p className="text-muted mt-2 text-sm">Last updated {updated}</p>
            <div className="text-muted mt-6 text-[16px] leading-relaxed">{intro}</div>
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="mt-10 scroll-mt-6">
                <h2 id={`${s.id}-title`} className="text-xl font-semibold">
                  {s.title}
                </h2>
                <div className="text-muted mt-3 flex flex-col gap-3 text-[15px] leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-text">
                  {s.body}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
