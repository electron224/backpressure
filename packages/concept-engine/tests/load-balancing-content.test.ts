// packages/concept-engine/tests/load-balancing-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { LabPresetSchema, runPreset } from "../src/index.js";
import { labPreset } from "../../../content/concepts/load-balancing/lab.js";

// NOTE: brief specified "../../content/..." here, but readFileSync resolves
// relative to process.cwd() (repo root under `pnpm vitest run`), where that
// path escapes the repo. Root-relative DIR is the minimal fix.
const DIR = "content/concepts/load-balancing";

describe("load-balancing content", () => {
  it("meta validates", () => {
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("load-balancing");
  });

  it("challenges validate", () => {
  });

  it("recall validates", () => {
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall)).toHaveLength(4);
  });

  it("learn.mdx is under 600 words", () => {
    const mdx = readFileSync(`${DIR}/learn.mdx`, "utf8");
    const words = mdx.split(/\s+/).filter((w) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });
});

describe("load-balancing add-on", () => {
  it("edge cache cuts p99 without changing the base preset", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const addon = preset.addons?.find((a) => a.id === "edge-cache");
    if (addon === undefined) throw new Error("missing edge-cache addon");
    const base = runPreset(preset, { strategy: "round-robin", rps: 80 });
    const merged = {
      ...preset,
      topology: {
        nodes: [...preset.topology.nodes, ...addon.topology.nodes],
        edges: [...preset.topology.edges, ...addon.topology.edges],
      },
    };
    const cached = runPreset(merged, { strategy: "round-robin", rps: 80 });
    expect(cached.p99).toBeLessThan(base.p99 / 2);
  });
});
