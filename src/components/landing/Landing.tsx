import { ArrowRight, ArrowUpRight } from "lucide-react";

import {
  Apple,
  Atom,
  Calculator,
  Chalkboard,
  Circuit,
  ForceDiagram,
  Magnet,
  NewtonsCradle,
  Pendulum,
  Prism,
  Textbook,
  Thermometer,
  Wave,
} from "@/components/physics/illustrations";
import { ParticleFieldLazy } from "@/components/physics/ParticleFieldLazy";
import { SAMPLE_ART } from "@/components/physics/topic-art";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Wordmark } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { chatHrefFor, SAMPLE_QUESTIONS } from "@/lib/sample-questions";

import { HowItWorks } from "./HowItWorks";
import { IntentLink } from "./IntentLink";
import { LabBench } from "./LabBench";
import { SiteFooter } from "./SiteFooter";

export { AUTHOR, COPYRIGHT_YEAR } from "./SiteFooter";

const CAPABILITIES = [
  {
    Ill: Textbook,
    title: "Answers from your textbook",
    body: "Upload a PDF and each answer cites the exact pages it draws on, so you can check every claim.",
  },
  {
    Ill: Calculator,
    title: "Complete worked solutions",
    body: "Given, find, relevant laws, working and a final check. Units are carried through every line.",
  },
  {
    Ill: Chalkboard,
    title: "Equations typeset properly",
    body: "Mathematics is rendered as it would appear in a textbook, even while the answer is still arriving.",
  },
  {
    Ill: Wave,
    title: "Streams as it writes",
    body: "The answer starts to appear within about a second, and you can stop it at any point.",
  },
  {
    Ill: NewtonsCradle,
    title: "Follows the conversation",
    body: "Follow-up questions such as “what if the mass doubles?” build on the previous answer.",
  },
  {
    Ill: Apple,
    title: "Focused on physics",
    body: "Questions outside physics receive a short, polite note and a way back to the subject.",
  },
];

const TOPICS = [
  {
    Ill: ForceDiagram,
    name: "Mechanics",
    q: "A 5 kg block rests on a 30° incline. What is the normal force on it?",
  },
  { Ill: Pendulum, name: "Oscillations", q: "Derive the period of a simple pendulum for small angles." },
  {
    Ill: Circuit,
    name: "Electricity",
    q: "How does current divide between two resistors connected in parallel?",
  },
  { Ill: Magnet, name: "Magnetism", q: "Why do magnetic field lines never cross each other?" },
  { Ill: Prism, name: "Optics", q: "Why does a glass prism split white light into colours?" },
  { Ill: Thermometer, name: "Thermal physics", q: "What is the difference between heat and temperature?" },
  {
    Ill: Apple,
    name: "Gravitation",
    q: "Why do all objects fall with the same acceleration near the Earth?",
  },
  {
    Ill: Atom,
    name: "Modern physics",
    q: "What does the photoelectric effect tell us about the nature of light?",
  },
];

function SectionIntro({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-field text-sm font-medium">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold">
        {title}
      </h2>
      {lead && <p className="text-muted mt-3 text-[17px]">{lead}</p>}
    </div>
  );
}

export function Landing() {
  return (
    <div className="doodles relative min-h-dvh overflow-x-hidden">
      <header
        className="relative z-10 mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <IntentLink href="/" aria-label="Quiro Physics home" className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-sm)]">
          <Wordmark animated />
        </IntentLink>
        <nav aria-label="Site" className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <IntentLink
            href="/lab"
            className="text-muted hover:text-text hidden min-h-11 items-center rounded-md px-3 text-[15px] sm:inline-flex"
          >
            Lab
          </IntentLink>
          <IntentLink
            href="/library"
            className="text-muted hover:text-text hidden min-h-11 items-center rounded-md px-3 text-[15px] sm:inline-flex"
          >
            Library
          </IntentLink>
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

      <main id="main">
        <section aria-labelledby="hero-title" className="relative isolate">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <ParticleFieldLazy />
            <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_30%_30%,color-mix(in_oklch,var(--field)_10%,transparent),transparent_70%)]" />
            <div className="to-bg absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent" />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
            <div>
              <p className="text-field text-sm font-medium">AI physics tutor for students</p>
              <h1 id="hero-title" className="mt-3 text-[clamp(2.4rem,6.5vw,4.25rem)] font-semibold">
                Understand physics, one step at a time.
              </h1>
              <p
                id="hero-lead"
                className="text-muted mt-5 max-w-xl text-[clamp(1.05rem,2vw,1.2rem)] leading-relaxed"
              >
                Ask about anything from Newton&apos;s laws to quantum mechanics. Quiro Physics explains the
                idea, works through the solution step by step and typesets every equation properly. Upload
                your textbook and each answer cites the pages it comes from.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <IntentLink
                  href="/chat"
                  className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full sm:w-auto")}
                  data-testid="hero-cta"
                >
                  Ask a physics question <ArrowRight className="size-5" aria-hidden />
                </IntentLink>
                <a
                  href="#examples"
                  className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")}
                >
                  See worked examples
                </a>
              </div>
              <p className="text-muted mt-4 text-sm">
                Free to try. No account needed for your first questions.
              </p>
            </div>
            <LabBench />
          </div>
        </section>
        <section
          aria-labelledby="capabilities-title"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24"
        >
          <SectionIntro
            id="capabilities-title"
            eyebrow="What it does"
            title="A tutor that shows its working"
            lead="Built around the way physics is taught: the idea first, then the equations, then a result you can check."
          />
          <ul className="border-border bg-surface/60 mt-10 grid overflow-hidden rounded-[var(--radius-md)] border backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ Ill, title, body }) => (
              <li
                key={title}
                className="group border-border hover:bg-surface -mt-px -ml-px border-t border-l p-6 transition-colors"
              >
                <Ill className="h-20 w-auto" />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="text-muted mt-2 text-[15px] leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="topics-title" className="border-border bg-surface/40 border-y">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionIntro
              id="topics-title"
              eyebrow="Across the syllabus"
              title="Pick a topic to start with"
              lead="Each card opens the tutor with a starter question. Change it to whatever you are studying."
            />
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="topic-cards">
              {TOPICS.map(({ Ill, name, q }) => (
                <li key={name}>
                  <IntentLink
                    href={chatHrefFor(q)}
                    className="group border-border bg-bg/70 relative flex h-full flex-col rounded-[var(--radius-md)] border p-4 transition-[border-color,box-shadow] hover:border-[color-mix(in_oklch,var(--field)_55%,transparent)] hover:shadow-[0_12px_40px_-24px_var(--field)] sm:p-5"
                  >
                    <Ill className="h-16 w-auto self-start sm:h-20" />
                    <span className="font-display mt-4 pr-5 text-lg leading-snug font-semibold">
                      {name}
                      <ArrowUpRight
                        className="text-muted group-hover:text-field absolute top-4 right-4 size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden
                      />
                    </span>
                    <span className="text-muted mt-1 hidden text-sm sm:block">{q}</span>
                  </IntentLink>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <HowItWorks />
        <section
          id="examples"
          aria-labelledby="examples-title"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24"
        >
          <SectionIntro
            id="examples-title"
            eyebrow="Worked examples"
            title="See a full answer"
            lead="These examples run end to end in this preview, including the reasoning, the working and the sources."
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2" data-testid="sample-chips">
            {SAMPLE_QUESTIONS.map((s) => {
              const Ill = SAMPLE_ART[s.topic];
              return (
                <li key={s.label}>
                  <IntentLink
                    href={chatHrefFor(s.question)}
                    className="group border-border bg-surface/70 flex h-full min-h-11 items-center gap-4 rounded-[var(--radius-md)] border p-4 transition-[border-color,box-shadow] hover:border-[color-mix(in_oklch,var(--field)_55%,transparent)] hover:shadow-[0_12px_40px_-24px_var(--field)]"
                  >
                    <Ill className="h-14 w-20 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-field text-xs font-medium">{s.topic}</span>
                      <span className="font-display text-lg font-semibold">{s.label}</span>
                      <span className="text-muted text-sm">{s.question}</span>
                    </span>
                  </IntentLink>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
