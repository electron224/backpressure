// packages/coach/src/persona-data.ts
// Client-safe: no node imports. Loader lives in persona.ts (server-only).
import { z } from "zod";

export const PersonaSchema = z.enum(["silent", "collaborative", "adversarial"]);
export type Persona = z.infer<typeof PersonaSchema>;

export const PERSONAS: { id: Persona; label: string; blurb: string }[] = [
  { id: "silent", label: "Silent", blurb: "Quiet room. Short questions, no hints." },
  { id: "collaborative", label: "Collaborative", blurb: "Thinks aloud. Names trade-offs, offers options." },
  { id: "adversarial", label: "Adversarial", blurb: "Skeptical. Challenges weakest assumption, demands numbers." },
];

export function parsePersona(value: unknown): Persona {
  return PersonaSchema.safeParse(value).success ? (value as Persona) : "collaborative";
}
