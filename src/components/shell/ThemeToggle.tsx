"use client";

import { Moon, Sun } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/cn";

/** Plain button (no Motion) so the landing page doesn't load the animation library just for this. */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, , toggle] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next === "light" ? "Lab Light" : "Dark Matter"} theme`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      data-testid="theme-toggle"
      className={cn(
        buttonVariants({ variant: "ghost", size: withLabel ? "md" : "icon" }),
        "active:scale-[0.97]",
        withLabel && "w-full justify-start",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      {withLabel && <span>{next === "light" ? "Lab Light" : "Dark Matter"}</span>}
    </button>
  );
}
