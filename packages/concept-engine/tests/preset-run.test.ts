// packages/concept-engine/tests/preset-run.test.ts
import { describe, expect, it } from "vitest";
import { labPreset } from "../../../content/concepts/load-balancing/lab.js";
import { LabPresetSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";

function lbValues(strategy: string, rps: number): Record<string, string | number> {
  return { strategy, rps };
}

describe("runPreset LB parity (seed 7, 80 RPS)", () => {
  it("round-robin fails the 150ms SLO near 2078ms", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, lbValues("round-robin", 80));
    expect(result.verdict).toBe("FAIL");
    expect(result.p99).toBeGreaterThan(1000);
  });

  it("least-connections passes near 146ms", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, lbValues("least-connections", 80));
    expect(result.verdict).toBe("PASS");
    expect(result.p99).toBeLessThan(150);
  });

  it("throws on unknown strategy", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(() => runPreset(preset, lbValues("magic-hash", 80))).toThrow(/unknown strategy/i);
  });

  it("sticky pins the first backend", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, lbValues("sticky", 80));
    expect(result.narration).toContain("fast: served=400");
  });

  it("nodeId.field overrides service config", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const slow = runPreset(preset, { strategy: "least-connections", rps: 80, "fast.serviceMs": 200 });
    expect(slow.p99).toBeGreaterThan(150);
  });

  it("dropping the last backend fails with narration, not a crash", () => {
    const preset = LabPresetSchema.parse({
      id: "spof-single",
      topology: {
        nodes: [{ id: "web", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } }],
        edges: [],
      },
      controls: [],
      metrics: ["p99"],
      challenges: [{ id: "s1", text: "Survive", verdict: "slo.p99" }],
    });
    const before = runPreset(preset, { rps: 80 });
    expect(before.verdict).toBe("PASS");
    const after = runPreset(preset, { rps: 80 }, { dropBackend: "web" });
    expect(after.verdict).toBe("FAIL");
    expect(after.narration).toContain("all backends down");
  });
});
