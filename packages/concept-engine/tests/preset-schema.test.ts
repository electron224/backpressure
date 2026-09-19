// packages/concept-engine/tests/preset-schema.test.ts
import { describe, expect, it } from "vitest";
import { ChallengeSchema, LabPresetSchema } from "../src/schema.js";

const baseTopology = {
  nodes: [
    { id: "lb", kind: "lb", config: {} },
    { id: "fast", kind: "service", config: { serviceMs: 20, concurrency: 2, queueLimit: 50 } },
  ],
  edges: [{ from: "lb", to: "fast" }],
};

describe("LabPresetSchema", () => {
  it("accepts a minimal preset", () => {
    const parsed = LabPresetSchema.parse({
      id: "x",
      topology: baseTopology,
      controls: [{ id: "rps", label: "RPS", kind: "slider", min: 10, max: 300, def: 80 }],
      metrics: ["p99"],
      challenges: [{ id: "c1", text: "Do X", verdict: "slo.p99" }],
    });
    expect(parsed.id).toBe("x");
  });

  it("rejects a select without options", () => {
    expect(() =>
      LabPresetSchema.parse({
        id: "x",
        topology: baseTopology,
        controls: [{ id: "s", label: "S", kind: "select", def: "a" }],
        metrics: ["p99"],
        challenges: [{ id: "c1", text: "Do X", verdict: "slo.p99" }],
      }),
    ).toThrow();
  });

  it("rejects a slider without min/max", () => {
    expect(() =>
      LabPresetSchema.parse({
        id: "x",
        topology: baseTopology,
        controls: [{ id: "r", label: "R", kind: "slider", def: 80 }],
        metrics: ["p99"],
        challenges: [{ id: "c1", text: "Do X", verdict: "slo.p99" }],
      }),
    ).toThrow();
  });

  it("rejects an unknown node kind", () => {
    expect(() =>
      LabPresetSchema.parse({
        id: "x",
        topology: { nodes: [{ id: "q", kind: "cdn", config: {} }], edges: [] },
        controls: [],
        metrics: ["p99"],
        challenges: [{ id: "c1", text: "Do X", verdict: "slo.p99" }],
      }),
    ).toThrow();
  });
});

describe("ChallengeSchema apply/show", () => {
  it("accepts apply + show", () => {
    const parsed = ChallengeSchema.parse({
      id: "lb.1",
      text: "Keep p99 under 150ms",
      verdict: "slo.p99",
      apply: { set: { strategy: "least-connections", rps: 80 } },
      show: "least-connections",
    });
    expect(parsed.show).toBe("least-connections");
  });
});
