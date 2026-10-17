import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  className,
  art,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  /** Decorative physics illustration shown beside the title (hidden on small phones). */
  art?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      {art && (
        <div className="order-last hidden h-20 shrink-0 sm:block [&>svg]:h-full [&>svg]:w-auto">{art}</div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[clamp(1.6rem,3.5vw,2.2rem)] font-semibold">{title}</h1>
        {description && <p className="text-muted mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {children}
    </header>
  );
}

/** Scrollable page body inside the app shell. */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className={cn("mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10", className)}>{children}</div>
    </div>
  );
}
