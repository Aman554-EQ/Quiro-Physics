"use client";

import { useState } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { conversationsApi, notifyConversationsChanged } from "@/lib/conversations-client";

/** Settings → delete every saved chat. Type DELETE to confirm (UI_UX.md §5). */
export function DeleteAllHistory() {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = typed === "DELETE";

  return (
    <section
      aria-labelledby="danger-title"
      className="border-danger/40 space-y-3 rounded-[var(--radius-md)] border p-5"
      data-testid="delete-all-history"
    >
      <h2 id="danger-title" className="text-lg font-semibold">
        Delete all history
      </h2>
      <p className="text-muted text-[15px]">
        Removes every saved chat and everything the tutor remembers about them. This can&apos;t be undone.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!armed) return;
          setBusy(true);
          try {
            const { deleted } = await conversationsApi.removeAll();
            toast.success(deleted === 1 ? "Deleted 1 chat." : `Deleted ${deleted} chats.`);
            setTyped("");
            notifyConversationsChanged();
          } catch {
            toast.error("Couldn't delete your history. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Type <strong>DELETE</strong> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="border-border bg-surface-2 min-h-11 rounded-[var(--radius-sm)] border px-3"
            data-testid="delete-all-input"
          />
        </label>
        <button
          type="submit"
          disabled={!armed || busy}
          className={cn(buttonVariants({ variant: "primary" }), "bg-danger text-white disabled:opacity-50")}
        >
          Delete all history
        </button>
      </form>
    </section>
  );
}
