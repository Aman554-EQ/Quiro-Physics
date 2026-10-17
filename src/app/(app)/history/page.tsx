import type { Metadata } from "next";

import { HistoryView } from "@/components/history/HistoryView";
import { Pendulum } from "@/components/physics/illustrations";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <PageBody>
      <PageHeader
        title="History"
        description="Your saved conversations, grouped by date. Search, rename, pin or delete them."
        art={<Pendulum />}
      />
      <HistoryView />
    </PageBody>
  );
}
