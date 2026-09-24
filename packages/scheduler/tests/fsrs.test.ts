// packages/scheduler/tests/fsrs.test.ts
import { describe, expect, it } from "vitest";
import { nextInterval, retrievability, review } from "../src/fsrs.js";
import type { CardState } from "../src/fsrs.js";

describe("fsrs", () => {
  it("starts new cards due tomorrow", () => {
    const card = review(null, 3, 100);
    expect(card.dueDay).toBe(101);
    expect(card.lastReviewDay).toBe(100);
    expect(card.stability).toBeGreaterThan(0);
  });

  it("orders grades: easy grows stability most, again resets", () => {
    const base: CardState = { stability: 10, difficulty: 5, dueDay: 100, lastReviewDay: 95 };
    const easy = review(base, 4, 100).stability;
    const good = review(base, 3, 100).stability;
    const hard = review(base, 2, 100).stability;
    const again = review(base, 1, 100).stability;
    expect(easy).toBeGreaterThan(good);
    expect(good).toBeGreaterThan(hard);
    expect(again).toBeLessThan(good);
  });

  it("is deterministic for identical reviews", () => {
    const base: CardState = { stability: 10, difficulty: 5, dueDay: 100, lastReviewDay: 95 };
    expect(review(base, 3, 100)).toEqual(review(base, 3, 100));
  });

  it("retrievability decays with elapsed days", () => {
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(30, 10)).toBeLessThan(retrievability(5, 10));
  });

  it("intervals grow with stability", () => {
    expect(nextInterval(100)).toBeGreaterThan(nextInterval(10));
  });
});
