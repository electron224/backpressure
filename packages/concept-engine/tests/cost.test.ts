// packages/concept-engine/tests/cost.test.ts
import { describe, expect, it } from "vitest";
import { LabPresetSchema } from "../src/schema.js";
import { estimateCost } from "../src/cost.js";
import { labPreset as loadBalancing } from "../../../content/concepts/load-balancing/lab.js";

describe("estimateCost", () => {
  it("scales with traffic and counts nodes", () => {
    const preset = LabPresetSchema.parse(loadBalancing);
    const quiet = estimateCost(preset, 80);
    const loud = estimateCost(preset, 160);
    expect(loud.monthlyUsd).toBeGreaterThan(quiet.monthlyUsd);
    expect(quiet.lines.length).toBeGreaterThan(0);
    expect(quiet.monthlyUsd).toBe(quiet.lines.reduce((sum, line) => sum + line.monthlyUsd, 0));
  });

  it("prices bigger fleets higher at fixed traffic", () => {
    const one = LabPresetSchema.parse({
      id: "t",
      topology: { nodes: [{ id: "a", kind: "service", config: { concurrency: 2 } }], edges: [] },
      controls: [],
      metrics: ["p99"],
      challenges: [{ id: "c", text: "x", verdict: "slo.p99" }],
    });
    const two = LabPresetSchema.parse({
      id: "t",
      topology: {
        nodes: [
          { id: "a", kind: "service", config: { concurrency: 2 } },
          { id: "b", kind: "service", config: { concurrency: 8 } },
        ],
        edges: [],
      },
      controls: [],
      metrics: ["p99"],
      challenges: [{ id: "c", text: "x", verdict: "slo.p99" }],
    });
    expect(estimateCost(two, 80).monthlyUsd).toBeGreaterThan(estimateCost(one, 80).monthlyUsd);
  });
});
