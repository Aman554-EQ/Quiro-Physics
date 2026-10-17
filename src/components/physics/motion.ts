import type { Transition } from "motion/react";

/**
 * Spring tokens — everything that moves in the UI moves "as if it had mass".
 * soft: messages, cards · snappy: buttons, toggles · heavy: sidebars, drawers.
 */
export const spring = {
  soft: { type: "spring", stiffness: 170, damping: 26, mass: 1 },
  snappy: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
  heavy: { type: "spring", stiffness: 120, damping: 20, mass: 1.6 },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof spring;

/** Under reduced motion, every spring becomes a short fade. */
export const REDUCED_TRANSITION = { duration: 0.15, ease: "easeOut" } as const satisfies Transition;

export function getTransition(t: Transition, reduced: boolean): Transition {
  return reduced ? REDUCED_TRANSITION : t;
}
