"use client";

import type { VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";

import { getTransition, spring } from "@/components/physics/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

import { buttonVariants } from "./button-variants";

export { buttonVariants };

export type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> &
  VariantProps<typeof buttonVariants> & { children?: React.ReactNode };

/** Button with a physical press (spring scale), disabled with both `disabled` and `aria-disabled`. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, disabled, type = "button", ...props },
  ref,
) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
      transition={getTransition(spring.snappy, reduced)}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
