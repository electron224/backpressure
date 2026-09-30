// packages/coach/src/cards-data.ts
// Client-safe: no node imports. Deterministic draw lives in cards.ts.
import { z } from "zod";

export const ConstraintCardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  probe: z.string().min(1),
});
export type ConstraintCard = z.infer<typeof ConstraintCardSchema>;

// Mid-design constraint flips. Generic across problems on purpose: each
// card forces adaptation instead of a memorised answer. Deck is data, not
// model output, so cards stay deterministic and prompt-injection proof.
export const CONSTRAINT_CARDS: ConstraintCard[] = [
  {
    id: "eu-residency",
    title: "EU data residency",
    body: "Legal now requires EU user data to stay in the EU. Name what moves, what replicates, and what the read path pays.",
    probe: "Which component breaks first under this constraint, and what number proves it?",
  },
  {
    id: "budget-cut",
    title: "Budget cut 40%",
    body: "Budget cut 40%. Remove or downscale one component and defend the cost against the latency or availability number you lose.",
    probe: "What did you remove, and which observed number justifies the trade?",
  },
  {
    id: "az-loss",
    title: "Lose one AZ",
    body: "One availability zone goes dark mid-review. State exactly what survives and what serves stale or fails.",
    probe: "What is the single failure that hurts most, in one sentence with a number?",
  },
  {
    id: "traffic-spike",
    title: "5x traffic spike",
    body: "Traffic spikes 5x for ten minutes. Name what sheds load first and where p99 goes.",
    probe: "Where does p99 go at 5x, and what sheds first?",
  },
  {
    id: "dependency-slow",
    title: "Slow dependency",
    body: "Your slowest dependency gains 400ms of p99. Show the bulkhead: what degrades gracefully instead of cascading?",
    probe: "What degrades on purpose, and what stays whole?",
  },
];
