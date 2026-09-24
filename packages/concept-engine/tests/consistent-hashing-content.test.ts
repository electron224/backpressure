// packages/concept-engine/tests/consistent-hashing-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createShardRouter } from "@backpressure/sim-components";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/consistent-hashing/lab.js";

const DIR = "content/concepts/consistent-hashing";

describe("consistent-hashing content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("consistent-hashing");
    expect(preset.variants).toHaveLength(2);
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("consistent-hashing");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("ring moves ~1/4 of keys on add, mod moves most", () => {
    const moved = (hashing: "mod" | "consistent"): number => {
      const before = createShardRouter("r", ["s0", "s1", "s2"], { hashing, virtualNodes: 100 });
      const after = createShardRouter("r", ["s0", "s1", "s2", "s3"], { hashing, virtualNodes: 100 });
      let changed = 0;
      for (let key = 0; key < 200; key += 1) {
        if (before.ownerOf(key) !== after.ownerOf(key)) changed += 1;
      }
      return changed;
    };
    expect(moved("mod")).toBeGreaterThan(100);
    const ringMoved = moved("consistent");
    expect(ringMoved).toBeLessThan(80);
    expect(ringMoved).toBeGreaterThan(10);
  });

  it("all four rows complete at 150 skewed", () => {
    const preset = LabPresetSchema.parse(labPreset);
    for (const hashing of ["mod", "consistent"]) {
      for (const variant of preset.variants ?? []) {
        const result = runPreset(
          { ...preset, topology: variant.topology ?? preset.topology },
          { rps: 150, skewPct: 120, hashing },
        );
        expect(result.rejected).toBe(0);
      }
    }
  });
});
