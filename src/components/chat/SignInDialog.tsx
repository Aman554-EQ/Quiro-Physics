"use client";

import { Bookmark, BookOpenText, LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";

const PERKS = [
  { Icon: Sparkles, text: "Keep going with this conversation" },
  { Icon: Bookmark, text: "Every chat saved to your history" },
  { Icon: BookOpenText, text: "Answers that cite your own textbooks" },
];

/**
 * Shown once when a guest reaches the guest limit (the server enforces it; P2-S5). Guests never see
 * counts before this: the limit appears only as an invitation to sign in.
 */
export function SignInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid="sign-in-dialog"
          className="border-border bg-surface fixed top-1/2 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border p-6 shadow-[0_24px_80px_-32px_var(--field)]"
        >
          <Dialog.Title className="text-xl font-semibold">Sign in to keep going</Dialog.Title>
          <Dialog.Description className="text-muted mt-2 text-[15px] leading-relaxed">
            You&apos;re on a roll. Create a free account or sign in to continue this conversation.
          </Dialog.Description>
          <ul className="mt-5 flex flex-col gap-2.5">
            {PERKS.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px]">
                <span className="bg-surface-2 text-field grid size-8 shrink-0 place-items-center rounded-md">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <Link href="/sign-in" className={cn(buttonVariants({ variant: "primary" }), "min-h-11 flex-1")}>
              <LogIn className="size-4" aria-hidden /> Sign in
            </Link>
            <Link href="/sign-up" className={cn(buttonVariants({ variant: "secondary" }), "min-h-11 flex-1")}>
              Create a free account
            </Link>
          </div>
          <Dialog.Close className="text-muted hover:text-text mx-auto mt-3 block min-h-9 px-3 text-sm">Not now</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
