/**
 * Structured physics facts kept per conversation (MEMORY_SYSTEM.md §4, layer L3).
 * Zod-validated on every write; invalid summariser output never replaces good memory.
 */
import { z } from "zod";

export const PhysicsFactsSchema = z
  .object({
    currentTopic: z.string().max(80),
    explanationLevel: z.enum(["intro", "intermediate", "advanced"]),
    activeProblem: z.object({
      statement: z.string().max(400),
      givens: z.array(z.object({ symbol: z.string(), value: z.string(), unit: z.string() })).max(12),
      unknowns: z.array(z.string()).max(6),
      status: z.enum(["solving", "solved"]),
    }),
    symbols: z.array(z.object({ symbol: z.string(), meaning: z.string(), unit: z.string().optional() })).max(15),
    assumptions: z.array(z.string().max(80)).max(8),
    keyEquations: z.array(z.string().max(160)).max(8),
    referencedSections: z
      .array(z.object({ documentId: z.string().uuid(), section: z.string(), pages: z.string() }))
      .max(8),
    unresolvedQuestions: z.array(z.string().max(160)).max(5),
  })
  .partial();

export type PhysicsFacts = z.infer<typeof PhysicsFactsSchema>;
