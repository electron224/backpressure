// packages/concept-engine/tests/chaos.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "@backpressure/sim-core";
import { pickRandomFault } from "../src/chaos.js";

describe("pickRandomFault", () => {
  it("is deterministic for the same seed", () => {
    const a = pickRandomFault(createRng(3), ["fast", "slow"]);
    const b = pickRandomFault(createRng(3), ["fast", "slow"]);
    expect(a).toEqual(b);
  });

  it("targets a real backend on kill-node", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const fault = pickRandomFault(createRng(seed), ["fast", "slow"]);
      if (fault.fault === "kill-node") {
        expect(["fast", "slow"]).toContain(fault.targets?.[0]);
      } else {
        expect(fault.fault).toBe("traffic-spike");
      }
    }
  });

  it("throws on empty backends", () => {
    expect(() => pickRandomFault(createRng(1), [])).toThrow(/backend/i);
  });
});
