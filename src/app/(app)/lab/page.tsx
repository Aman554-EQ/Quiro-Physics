import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  Atom,
  Circuit,
  ForceDiagram,
  Pendulum,
  Prism,
  Projectile,
  Wave,
} from "@/components/physics/illustrations";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { chatHrefFor } from "@/lib/sample-questions";

export const metadata: Metadata = { title: "Lab" };

const SIMS = [
  {
    Ill: Projectile,
    title: "Projectile motion",
    question: "How does the launch angle affect the range of a projectile?",
    body: "Set the launch speed, angle and gravity, then compare the parabolas and their ranges.",
  },
  {
    Ill: Pendulum,
    title: "Simple pendulum",
    question: "When does the small-angle approximation for a pendulum stop being accurate?",
    body: "Change the length and amplitude to see where the small-angle approximation breaks down.",
  },
  {
    Ill: Wave,
    title: "Wave interference",
    question: "Where do the bright fringes form in a double-slit experiment?",
    body: "Adjust the slit spacing and wavelength and find where the bright fringes form.",
  },
  {
    Ill: Circuit,
    title: "DC circuits",
    question: "How does current divide between resistors in parallel?",
    body: "Build series and parallel circuits and watch how current and voltage divide.",
  },
  {
    Ill: Prism,
    title: "Refraction and dispersion",
    question: "Why does a prism split white light into colours?",
    body: "Send light through a prism and see how the refractive index depends on wavelength.",
  },
  {
    Ill: ForceDiagram,
    title: "Forces on an incline",
    question: "At what angle does a block start to slide down a rough incline?",
    body: "Vary the angle and friction and see when the block starts to slide.",
  },
];

export default function LabPage() {
  return (
    <PageBody>
      <PageHeader
        title="Lab"
        description="Interactive simulations you can adjust, then ask the tutor about the exact setup. Coming soon."
        art={<Atom />}
      />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMS.map(({ Ill, title, question, body }) => (
          <li
            key={title}
            className="group border-border bg-surface/70 hover:bg-surface flex flex-col rounded-[var(--radius-md)] border p-5 transition-colors"
          >
            <div className="graph-paper border-border bg-bg/60 flex h-32 items-center justify-center rounded-[var(--radius-sm)] border p-3">
              <Ill className="h-full w-full" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">{title}</h2>
            <p className="text-muted mt-1 flex-1 text-[15px]">{body}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Link
                href={chatHrefFor(question)}
                className="text-field inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline"
              >
                Ask the tutor about this<span className="sr-only">: {title}</span>{" "}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <span className="text-muted text-xs">Simulation coming soon</span>
            </div>
          </li>
        ))}
      </ul>
    </PageBody>
  );
}
