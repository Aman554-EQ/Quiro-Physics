import { ArrowUpRight, Atom, Ruler, Sigma } from "lucide-react";

import { Wordmark } from "@/components/ui/brand";

import { IntentLink } from "./IntentLink";
import { NewsletterForm } from "./NewsletterForm";

export const AUTHOR = { name: "Aman554-EQ", url: "https://github.com/Aman554-EQ" } as const;
export const REPO_URL = "https://github.com/Aman554-EQ/Quiro-Physics";
export const COPYRIGHT_YEAR = 2026;

const STUDY = [
  { label: "Ask the tutor", href: "/chat" },
  { label: "Physics lab", href: "/lab" },
  { label: "Your textbooks", href: "/library" },
  { label: "Study history", href: "/history" },
  { label: "Example questions", href: "/#examples" },
];

const PROMISES = [
  { Icon: Atom, text: "Intuition first, then the maths" },
  { Icon: Sigma, text: "Equations in LaTeX, step by step" },
  { Icon: Ruler, text: "SI units on every quantity" },
];

const link = "inline-flex min-h-9 items-center text-muted hover:text-text";
const heading = "text-text text-sm font-medium";

/**
 * Site footer (landing and legal pages), one block: brand on the left, study and legal links in
 * the middle, the weekly physics email on the right, then the copyright line.
 */
export function SiteFooter() {
  return (
    <footer className="border-border bg-surface/50 border-t" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.25fr_0.7fr_0.8fr_1.35fr] lg:gap-x-10">
        {/* Brand */}
        <div className="col-span-2 lg:col-span-1">
          <Wordmark />
          <p className="text-muted mt-4 max-w-sm text-sm leading-relaxed">
            An AI tutor for students of physics. It explains the idea, shows the maths and checks the units, and cites
            your own textbook when you upload one.
          </p>
          <ul className="mt-4 flex flex-col gap-2" aria-label="How Quiro Physics answers">
            {PROMISES.map(({ Icon, text }) => (
              <li key={text} className="text-muted flex items-center gap-2 text-[13px]">
                <Icon className="text-field size-3.5 shrink-0" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Links */}
        <nav aria-label="Study" className="text-sm">
          <p className={heading}>Study</p>
          <ul className="mt-2">
            {STUDY.map((s) => (
              <li key={s.href}>
                <IntentLink href={s.href} className={link}>
                  {s.label}
                </IntentLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Help and legal" className="text-sm">
          <p className={heading}>Help and legal</p>
          <ul className="mt-2">
            <li>
              <IntentLink href="/privacy" className={link}>
                Privacy policy
              </IntentLink>
            </li>
            <li>
              <IntentLink href="/terms" className={link}>
                Terms of use
              </IntentLink>
            </li>
            <li>
              <IntentLink href="/terms#academic-integrity" className={link}>
                Academic integrity
              </IntentLink>
            </li>
            <li>
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className={link}>
                Report a problem <ArrowUpRight className="ml-1 size-3.5" aria-hidden />
              </a>
            </li>
            <li>
              <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className={link}>
                GitHub <ArrowUpRight className="ml-1 size-3.5" aria-hidden />
              </a>
            </li>
          </ul>
        </nav>

        {/* Newsletter */}
        <section aria-labelledby="newsletter-title" className="col-span-2 lg:col-span-1">
          <p className="text-field text-xs font-medium tracking-[0.14em] uppercase">The Quiro Physics letter</p>
          <h2 id="newsletter-title" className="font-display mt-1.5 text-xl font-semibold">
            One physics idea a week
          </h2>
          <p className="text-muted mt-1.5 mb-4 text-sm leading-relaxed">
            A short explanation, one worked problem and a study tip, from Newton&apos;s laws to quantum tunnelling.
          </p>
          <NewsletterForm />
        </section>
      </div>

      {/* Bottom line */}
      <div className="border-border border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-muted" data-testid="copyright">
            © {COPYRIGHT_YEAR} Quiro Physics · Built by{" "}
            <a
              href={AUTHOR.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text font-medium underline underline-offset-4"
            >
              {AUTHOR.name}
            </a>
          </p>
          <p className="text-muted text-[13px]">
            Answers can contain mistakes. Check important results against your course material.
          </p>
        </div>
      </div>
    </footer>
  );
}
