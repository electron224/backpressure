// packages/concept-engine/src/schema.ts
import { z } from "zod";

export const ConceptMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prerequisites: z.array(z.string()),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimated_minutes: z.number().int().positive(),
  tags: z.array(z.string()),
});

export type ConceptMeta = z.infer<typeof ConceptMetaSchema>;

export const ChallengeSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  verdict: z.string().min(1),
});

export type Challenge = z.infer<typeof ChallengeSchema>;

export const ChallengesSchema = z.array(ChallengeSchema).min(1);

export const RecallItemSchema = z.object({
  id: z.string().min(1),
  q: z.string().min(1),
  a: z.string().min(1),
});

export type RecallItem = z.infer<typeof RecallItemSchema>;

export const RecallItemsSchema = z.array(RecallItemSchema).min(1);
