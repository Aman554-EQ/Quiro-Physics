import type { Metadata } from "next";

import { LegalPage } from "@/components/landing/LegalPage";
import { REPO_URL } from "@/components/landing/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Quiro Physics stores, why, who processes it and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="17 October 2026"
      intro={
        <p>
          Quiro Physics is an AI physics tutor. We keep only what the tutor needs to work: your questions and answers,
          the textbooks you choose to upload, and the basics of your account. We don&apos;t sell data and we don&apos;t
          show ads.
        </p>
      }
      sections={[
        {
          id: "what-we-store",
          title: "What we store",
          body: (
            <ul>
              <li>
                <strong>Account.</strong> If you sign in: your name, email address and profile picture from the sign-in
                provider, and your settings (explanation level, theme).
              </li>
              <li>
                <strong>Chats.</strong> Signed in: your questions, the tutor&apos;s answers, a short running summary of
                each conversation (so the tutor remembers context) and the textbook pages it cited. As a guest: your
                current chat is kept for 24 hours so you can continue it, then it expires.
              </li>
              <li>
                <strong>Textbooks you upload.</strong> The PDF is read, split into passages and indexed for search. The
                original file is deleted once indexing finishes; the passages stay until you delete the document.
              </li>
              <li>
                <strong>Usage limits.</strong> Counters that keep the free tutor available for everyone. For guests we
                use a random cookie and a hashed IP address that changes every day and can&apos;t be reversed.
              </li>
              <li>
                <strong>Newsletter.</strong> If you subscribe: your email address and the date.
              </li>
            </ul>
          ),
        },
        {
          id: "how-we-use-it",
          title: "How we use it",
          body: (
            <>
              <p>
                To answer your questions, show your history, cite your textbooks, enforce fair usage limits and send the
                weekly physics email if you asked for it. Error logs never contain your messages or PDF text.
              </p>
              <p>We never use your chats or textbooks to train AI models, and we never sell or rent your data.</p>
            </>
          ),
        },
        {
          id: "who-processes-it",
          title: "Services that process it",
          body: (
            <>
              <p>Quiro Physics runs on these providers, each handling only what its job needs:</p>
              <ul>
                <li>
                  <strong>Groq</strong> runs the language models: your question, recent turns and any cited passages are
                  sent to generate the answer.
                </li>
                <li>
                  <strong>Google Gemini</strong> turns textbook passages and questions into embeddings for search.
                </li>
                <li>
                  <strong>Clerk</strong> handles sign in. <strong>Neon</strong> (PostgreSQL) stores accounts, chats and
                  passages. <strong>Upstash</strong> stores usage counters, guest chats and newsletter sign ups.{" "}
                  <strong>Vercel</strong> hosts the site and holds uploaded PDFs until they are indexed.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              Only what the site needs: the sign-in session, a guest cookie for usage limits and your theme choice. No
              advertising or cross-site tracking cookies.
            </p>
          ),
        },
        {
          id: "your-choices",
          title: "Your choices",
          body: (
            <ul>
              <li>Delete a textbook from the Library: its passages and search index are removed at once.</li>
              <li>
                Delete your account from the account menu (Manage account): your chats, documents and preferences are
                deleted with it.
              </li>
              <li>Leave the newsletter at any time: every issue has an unsubscribe link, or ask us to remove you.</li>
            </ul>
          ),
        },
        {
          id: "children",
          title: "Students under 13",
          body: (
            <p>
              Quiro Physics is meant for secondary school and university students. If you are under 13, use it with a
              parent, guardian or teacher, and don&apos;t create an account.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Questions",
          body: (
            <p>
              Ask about this policy or request deletion by opening an issue on{" "}
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className="text-text underline underline-offset-4">
                GitHub
              </a>
              . We will update this page when anything changes.
            </p>
          ),
        },
      ]}
    />
  );
}
