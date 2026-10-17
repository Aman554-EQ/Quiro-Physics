import type { Metadata } from "next";

import { Calculator } from "@/components/physics/illustrations";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";

import { AppearanceSettings } from "./AppearanceSettings";
import { DeleteAllHistory } from "./DeleteAllHistory";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageBody>
      <PageHeader
        title="Settings"
        description="Appearance and motion apply right away on this device."
        art={<Calculator />}
      />
      <div className="mt-8 space-y-6">
        <AppearanceSettings />
        <DeleteAllHistory />
      </div>
    </PageBody>
  );
}
