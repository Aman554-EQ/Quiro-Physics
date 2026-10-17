"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useTheme } from "@/hooks/use-theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [theme] = useTheme();
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      {children}
      <Toaster theme={theme} position="top-center" richColors closeButton />
    </MotionConfig>
  );
}
