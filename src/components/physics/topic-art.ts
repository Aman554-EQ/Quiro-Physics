import type { SAMPLE_QUESTIONS } from "@/lib/sample-questions";

import { ForceDiagram, Pendulum, Projectile, Textbook } from "./illustrations";

/** Illustration for each sample-question topic (landing examples and the empty chat). */
export const SAMPLE_ART: Record<(typeof SAMPLE_QUESTIONS)[number]["topic"], typeof Textbook> = {
  Mechanics: ForceDiagram,
  Kinematics: Projectile,
  Oscillations: Pendulum,
  "Textbook demo": Textbook,
};
