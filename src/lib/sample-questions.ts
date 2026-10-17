export const SAMPLE_QUESTIONS = [
  { label: "Newton's second law", question: "What is Newton's second law?", topic: "Mechanics" },
  {
    label: "Projectile range",
    question: "A ball is thrown at 20 m/s at 30° above the horizontal. Find its range (g = 9.8 m/s²).",
    topic: "Kinematics",
  },
  {
    label: "Pendulum period",
    question: "Derive the period of a simple pendulum for small angles.",
    topic: "Oscillations",
  },
  {
    label: "Ask my textbook",
    question: "What does my textbook say about the range of a projectile?",
    topic: "Textbook demo",
  },
] as const;

export function chatHrefFor(question: string) {
  return `/chat?q=${encodeURIComponent(question)}`;
}
