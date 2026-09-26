// packages/concept-engine/tests/fixit-content.test.ts
import { describe, expect, it } from "vitest";
import { LabPresetSchema, runPreset } from "../src/index.js";
import type { LabPreset, Topology } from "../src/index.js";
import { meltingApi } from "../../../content/fixits/melting-api.js";
import { lonelyDatabase } from "../../../content/fixits/lonely-database.js";
import { openFloodgate } from "../../../content/fixits/open-floodgate.js";

function presetFor(topology: Topology, sloP99Ms: number): LabPreset {
  return LabPresetSchema.parse({ id: "fixit", topology, controls: [], metrics: ["p99"], challenges: [{ id: "c", text: "x", verdict: "slo.p99" }], sloP99Ms });
}

function topo(nodes: Topology["nodes"], edges: Topology["edges"]): Topology {
  return LabPresetSchema.parse({
    id: "fixit",
    topology: { nodes, edges },
    controls: [],
    metrics: ["p99"],
    challenges: [{ id: "c", text: "x", verdict: "slo.p99" }],
  }).topology;
}

describe("fix-it scenarios", () => {
  it("fixit content has ids, stories, and starts", () => {
    for (const fixit of [meltingApi, lonelyDatabase, openFloodgate]) {
      expect(fixit.id.length).toBeGreaterThan(0);
      expect(fixit.story.length).toBeGreaterThan(20);
      expect(fixit.rps).toBeGreaterThan(0);
      LabPresetSchema.parse({
        id: fixit.id,
        topology: fixit.start,
        controls: [],
        metrics: ["p99"],
        challenges: [{ id: "c", text: "x", verdict: "slo.p99" }],
      });
    }
  });

  it("melting-api starts broken, cache shield fixes it", () => {
    const broken = runPreset(presetFor(topo([{ id: "api", kind: "service", config: {} }], []), 150), { rps: 250 });
    expect(broken.verdict).toBe("FAIL");
    const fixed = runPreset(presetFor(
      {
        nodes: [
          { id: "edge", kind: "cache", config: { ttlMs: 60_000, capacity: 1000, keySpace: 100, hitMs: 2 } },
          { id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
        ],
        edges: [{ from: "edge", to: "api" }],
      },
      150,
    ), { rps: 250 });
    expect(fixed.verdict).toBe("PASS");
  });

  it("lonely-database dies on kill, twins survive", () => {
    const single = topo([{ id: "db", kind: "database", config: {} }], []);
    const killed = runPreset(presetFor(single, 150), { rps: 80 }, { dropBackend: "db" });
    expect(killed.verdict).toBe("FAIL");
    const twins = topo(
      [
        { id: "lb", kind: "lb", config: {} },
        { id: "a", kind: "database", config: {} },
        { id: "b", kind: "database", config: {} },
      ],
      [
        { from: "lb", to: "a" },
        { from: "lb", to: "b" },
      ],
    );
    for (const target of ["a", "b"]) {
      const survived = runPreset(presetFor(twins, 150), { rps: 80 }, { dropBackend: target });
      expect(survived.verdict).toBe("PASS");
    }
  });

  it("open floodgate fails, limiter sheds clean", () => {
    const broken = runPreset(presetFor(topo([{ id: "api", kind: "service", config: {} }], []), 150), { rps: 300 });
    expect(broken.verdict).toBe("FAIL");
    const fixed = runPreset(presetFor(
      {
        nodes: [
          { id: "lim", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 100, burst: 10 } },
          { id: "api", kind: "service", config: {} },
        ],
        edges: [{ from: "lim", to: "api" }],
      },
      150,
    ), { rps: 300 });
    expect(fixed.verdict).toBe("PASS");
  });
});
