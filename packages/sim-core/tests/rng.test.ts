// packages/sim-core/tests/rng.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng.js";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.nextInt(100)];
    const seqB = [b.next(), b.next(), b.nextInt(100)];
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("nextInt stays in range", () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i += 1) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});
