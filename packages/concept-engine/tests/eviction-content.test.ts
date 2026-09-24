// packages/concept-engine/tests/eviction-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/eviction-policies/lab.js";

const DIR = "content/concepts/eviction-policies";

function hitsOf(narration: string): number {
  const match = narration.match(/hits=(\d+)/);
  const parsed = match?.[1] === undefined ? NaN : Number(match[1]);
  if (!Number.isInteger(parsed)) throw new Error(`no hits count in: ${narration}`);
  return parsed;
}

describe("eviction-policies content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("eviction-policies");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("eviction-policies");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("lfu and lru beat fifo under skew", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const fifo = hitsOf(runPreset(preset, { rps: 80, skewPct: 120, eviction: "fifo" }).narration);
    const lru = hitsOf(runPreset(preset, { rps: 80, skewPct: 120, eviction: "lru" }).narration);
    const lfu = hitsOf(runPreset(preset, { rps: 80, skewPct: 120, eviction: "lfu" }).narration);
    expect(lfu).toBeGreaterThan(fifo * 1.2);
    expect(lru).toBeGreaterThan(fifo);
  });

  it("policies converge under uniform traffic", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const counts = ["fifo", "lru", "lfu"].map(
      (eviction) => hitsOf(runPreset(preset, { rps: 80, skewPct: 0, eviction }).narration),
    );
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    expect(max - min).toBeLessThan(max * 0.5);
  });
});
