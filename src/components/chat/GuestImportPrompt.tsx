"use client";

import { Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { notifyConversationsChanged } from "@/lib/conversations-client";

/** The guest thread a visitor was using before they signed in (sessionStorage, this tab only). */
export const GUEST_THREAD_KEY = "prc-guest-thread";

export function rememberGuestThread(id: string) {
  try {
    sessionStorage.setItem(GUEST_THREAD_KEY, id);
  } catch {}
}

function readGuestThread() {
  try {
    return sessionStorage.getItem(GUEST_THREAD_KEY);
  } catch {
    return null;
  }
}

function forgetGuestThread() {
  try {
    sessionStorage.removeItem(GUEST_THREAD_KEY);
  } catch {}
}

/** After signing in: offer to save the guest chat into History (P2-S5-M05). */
export function GuestImportPrompt() {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadId(readGuestThread());
  }, []);
  if (!threadId) return null;

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/guest/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestThreadId: threadId }),
      });
      forgetGuestThread();
      setThreadId(null);
      if (!res.ok) {
        toast.error("That guest chat has expired or can't be found.");
        return;
      }
      const { conversationId } = (await res.json()) as { conversationId: string };
      notifyConversationsChanged();
      toast.success("Saved to your history.");
      router.push(`/chat/${conversationId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="guest-import"
      className="border-border bg-surface mx-auto mb-3 flex w-full max-w-[820px] flex-wrap items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3"
    >
      <p className="min-w-0 flex-1 text-sm">
        <strong>Save the chat you started as a guest?</strong> It will appear in your history.
      </p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className={cn(buttonVariants({ variant: "primary", size: "sm" }), "min-h-11 sm:min-h-9")}
      >
        <Save className="size-4" aria-hidden /> Save this chat
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          forgetGuestThread();
          setThreadId(null);
        }}
        className="text-muted hover:text-text grid size-11 place-items-center rounded-[var(--radius-sm)]"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
