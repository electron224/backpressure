// packages/coach/src/persona.ts
// Server-only loader. Client-safe data lives in persona-data.ts.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PERSONAS, PersonaSchema, parsePersona } from "./persona-data.js";
import type { Persona } from "./persona-data.js";

export { PERSONAS, PersonaSchema, parsePersona };
export type { Persona };

const here = dirname(fileURLToPath(import.meta.url));

export function personaFragment(persona: Persona): string {
  return readFileSync(join(here, "..", "prompts", "v2", "personas", `${persona}.md`), "utf8");
}
