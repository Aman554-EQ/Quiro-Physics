import { BrandMark } from "@/components/physics/illustrations";
import { cn } from "@/lib/cn";

export const BRAND_NAME = "Quiro Physics";

/** Logo + "Quiro Physics" wordmark. Decorative mark; the text is the name. */
export function Wordmark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-2.5 whitespace-nowrap", className)}>
      <BrandMark animated={animated} />
      <span className="font-display text-[19px] leading-none font-semibold tracking-tight">
        Quiro <span className="text-muted">Physics</span>
      </span>
    </span>
  );
}
