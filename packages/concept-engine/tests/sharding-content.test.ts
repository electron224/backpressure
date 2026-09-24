// packages/concept-engine/tests/sharding-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/sharding/lab.js";

const DIR = "content/concepts/sharding";

function shardServed(narration: string): number[] {
  const counts: number[] = [];
  for (const match of narration.matchAll(/s\d: served=(\d+)/g)) {
    counts.push(Number(match[1]));
  }
  if (counts.length === 0) throw new Error(`no shard counts in: ${narration}`);
  return counts;
}

describe("sharding content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("sharding");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("sharding");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("hot shard forms under skew: s0 saturates, siblings idle", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const hot = runPreset(preset, { rps: 200, skewPct: 150 });
    const served = shardServed(hot.narration);
    const hottest = Math.max(...served);
    const rest = served.filter((n) => n !== hottest);
    expect(hottest).toBeGreaterThan(Math.max(...rest) * 2);
    expect(hot.verdict).toBe("FAIL");
  });

  it("uniform skew balances the shards", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const served = shardServed(runPreset(preset, { rps: 200, skewPct: 0 }).narration);
    const max = Math.max(...served);
    const min = Math.min(...served);
    expect(max - min).toBeLessThan(max * 0.5);
  });
});
