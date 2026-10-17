import type { Metadata } from "next";

import { LegalPage } from "@/components/landing/LegalPage";
import { REPO_URL } from "@/components/landing/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "How to use Quiro Physics fairly: AI accuracy, academic integrity, uploads and limits.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="17 October 2026"
      intro={
        <p>
          Quiro Physics helps you understand physics. By using it you agree to these terms. They are short, and written
          to be read.
        </p>
      }
      sections={[
        {
          id: "what-it-is",
          title: "What Quiro Physics is",
          body: (
            <p>
              A free AI tutor that explains physics concepts, works through problems step by step and can cite the
              textbooks you upload. It is a study aid, not a replacement for your teacher, your course material or
              professional engineering advice.
            </p>
          ),
        },
        {
          id: "accuracy",
          title: "AI answers can be wrong",
          body: (
            <p>
              The tutor checks units and cites sources, but AI can still make mistakes in reasoning, arithmetic or
              constants. Check important results against your textbook, and never rely on an answer for safety
              critical work such as electrical wiring, lab procedures with hazardous materials or structural loads.
            </p>
          ),
        },
        {
          id: "academic-integrity",
          title: "Academic integrity",
          body: (
            <>
              <p>
                Use Quiro Physics to learn: to understand a concept, check your method or see a worked example. Follow
                your school&apos;s or university&apos;s rules on AI tools.
              </p>
              <ul>
                <li>Don&apos;t submit the tutor&apos;s answers as your own work where your course forbids it.</li>
                <li>Don&apos;t use it during closed book exams or assessments.</li>
                <li>When in doubt, ask your teacher and say that you used an AI tutor.</li>
              </ul>
            </>
          ),
        },
        {
          id: "uploads",
          title: "Textbooks you upload",
          body: (
            <p>
              Upload only PDFs you have the right to use for your own study, such as your course textbook or open
              textbooks. Your uploads stay private to your account; we don&apos;t share or publish them. We may remove
              content that breaks the law or these terms.
            </p>
          ),
        },
        {
          id: "fair-use",
          title: "Fair use and limits",
          body: (
            <p>
              The tutor is free, so usage limits keep it available for everyone. Guests can try it without an account;
              signing in unlocks saved chats, textbook uploads and higher limits. Don&apos;t try to get around the
              limits, overload the service, extract the prompts or use the tutor for anything harmful.
            </p>
          ),
        },
        {
          id: "service",
          title: "The service",
          body: (
            <p>
              Quiro Physics is provided as is. Features and limits may change, and the service may be unavailable at
              times. We may suspend accounts that misuse it.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <p>
              Questions or problems: open an issue on{" "}
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className="text-text underline underline-offset-4">
                GitHub
              </a>
              . See also the{" "}
              <a href="/privacy" className="text-text underline underline-offset-4">
                Privacy policy
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
