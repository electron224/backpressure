// packages/coach/src/cards.ts
// Server-only deterministic draw. Client-safe deck lives in cards-data.ts.
import { createHash } from "node:crypto";
import { CONSTRAINT_CARDS, ConstraintCardSchema } from "./cards-data.js";
import type { ConstraintCard } from "./cards-data.js";

export { CONSTRAINT_CARDS, ConstraintCardSchema };
export type { ConstraintCard };

export function drawConstraintCard(seed: string, excludeIds: string[] = []): ConstraintCard {
  const pool = CONSTRAINT_CARDS.filter((card) => !excludeIds.includes(card.id));
  const candidates = pool.length > 0 ? pool : CONSTRAINT_CARDS;
  const digest = createHash("sha256").update(seed).digest();
  const first = digest[0] ?? 0;
  const card = candidates[first % candidates.length];
  if (card === undefined) throw new Error("constraint deck is empty");
  return card;
}
