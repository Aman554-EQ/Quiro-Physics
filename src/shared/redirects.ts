/**
 * Canned replies that never need the tutor model (PROMPTS.md §2): off-topic redirects with a
 * physics hook, the unsafe-request refusal and the greeting. Shared by the server and the demo tutor.
 */
const HOOKS: Array<[RegExp, string]> = [
  [
    /\b(cook|recipe|biryani|food|bake|kitchen)\b/i,
    "**cooking is thermodynamics**: heat flows into food by conduction, convection and radiation, and a pressure cooker works because water boils at a higher temperature under higher pressure",
  ],
  [
    /\b(cricket|football|soccer|match|sport|basketball|tennis)\b/i,
    "**every ball game is projectile motion**, and spin adds the Magnus force, which is why a cricket ball can swing and a football can curl",
  ],
  [
    /\b(song|music|poem|guitar|sing)\b/i,
    "**music is waves**: a guitar string vibrates in standing-wave modes, and the harmonics you hear are integer multiples of the fundamental frequency",
  ],
  [
    /\b(stock|money|crypto|invest|price)\b/i,
    "**random walks**. The same mathematics that describes share prices first explained Brownian motion, which helped prove atoms exist",
  ],
  [
    /\b(python|code|program|scraper|javascript|app)\b/i,
    "**computers run on quantum physics**, since transistors work because of band gaps in semiconductors",
  ],
  [
    /\b(phone|wifi|bluetooth|radio)\b/i,
    "**your phone is electromagnetism in your pocket**: every message travels as radio waves, and the screen's touch sensor measures tiny changes in capacitance",
  ],
];

const DEFAULT_HOOK =
  "**everyday physics is everywhere**, from why the sky is blue (Rayleigh scattering) to how your phone knows which way is up (a tiny accelerometer)";

export function offTopicRedirect(question: string): string {
  const hook = HOOKS.find(([re]) => re.test(question))?.[1] ?? DEFAULT_HOOK;
  return `That's outside what I can help with, because I'm a physics tutor. But here's a physics angle you might enjoy: ${hook}.\n\nWant to explore that, or ask me any physics question?`;
}

export const UNSAFE_REFUSAL =
  "I can't help with that. I'm a physics tutor, and I won't give instructions that could hurt people, even when they're framed as physics.\n\nIf you're curious about the science behind something, I'm happy to explain the underlying principles safely. What would you like to understand?";

export const GREETING_REPLY =
  "Hello! I'm Ada, the Quiro Physics tutor. Ask me anything from Newton's laws to quantum mechanics: a concept you want explained, a problem to work through step by step, or a derivation.\n\nWhat would you like to understand today?";
