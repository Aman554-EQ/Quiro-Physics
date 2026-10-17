import { cn } from "@/lib/cn";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "border-border bg-surface-2 text-muted inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 font-mono text-[11px]",
        className,
      )}
      {...props}
    />
  );
}

/** Loading placeholder with a travelling "wave" shimmer. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-[var(--radius-sm)] bg-[linear-gradient(90deg,var(--surface-2)_0%,color-mix(in_oklch,var(--surface-2)_70%,var(--field))_50%,var(--surface-2)_100%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-surface/80 shadow-glow rounded-[var(--radius-md)] border p-5",
        className,
      )}
      {...props}
    />
  );
}
