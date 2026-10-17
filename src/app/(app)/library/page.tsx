import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LibraryView } from "@/components/library/LibraryView";
import { Textbook } from "@/components/physics/illustrations";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { signInRedirect } from "@/config/auth-routes";
import { getOptionalUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { listDocuments } from "@/server/db/queries/documents";
import { env } from "@/server/env";
import { uploadUsage } from "@/server/limits/quotas";
import { getBlobStore } from "@/server/storage/blob";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const user = await getOptionalUser();
  if (!user) redirect(signInRedirect("/library"));
  const db = await getDb();
  const [documents, usage] = await Promise.all([listDocuments(db, user.userId), uploadUsage(db, user.userId)]);
  const uploadsReady = getBlobStore() !== null;
  return (
    <PageBody>
      <PageHeader
        title="Library"
        description="Upload your physics textbooks as PDFs so that answers can cite the exact pages."
        art={<Textbook />}
      />
      {!uploadsReady && (
        <p className="border-border bg-surface/60 text-muted mt-6 rounded-[var(--radius-md)] border border-dashed p-4 text-[15px]">
          PDF uploads need Blob storage on this server. Add BLOB_READ_WRITE_TOKEN in the project settings.
        </p>
      )}
      <LibraryView
        initial={{ documents, ...usage, maxSizeMb: env.MAX_PDF_SIZE_MB, maxPages: env.MAX_PDF_PAGES }}
      />
    </PageBody>
  );
}
