// packages/concept-engine/tests/caching-strategies-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/caching-strategies/lab.js";

const DIR = "content/concepts/caching-strategies";

describe("caching-strategies content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("caching-strategies");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("caching-strategies");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("behind acks writes faster than through at 20% writes", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const behind = runPreset(preset, { rps: 80, writePct: 20, writePolicy: "behind" });
    const through = runPreset(preset, { rps: 80, writePct: 20, writePolicy: "through" });
    expect(behind.p99).toBeLessThan(through.p99);
  });

  it("all policies complete the mix without errors at 80 RPS", () => {
    const preset = LabPresetSchema.parse(labPreset);
    for (const policy of ["aside", "through", "behind", "ahead"]) {
      const result = runPreset(preset, { rps: 80, writePct: 20, writePolicy: policy });
      expect(result.rejected).toBe(0);
    }
  });
});
