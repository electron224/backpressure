// packages/concept-engine/tests/quorums-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/quorums-and-n-r-w/lab.js";

const DIR = "content/concepts/quorums-and-n-r-w";
const MIX = { rps: 80, writePct: 20, skewPct: 120 };

function staleOf(narration: string): number {
  const match = narration.match(/stale=(\d+)/);
  const parsed = match?.[1] === undefined ? NaN : Number(match[1]);
  if (!Number.isInteger(parsed)) throw new Error(`no stale count in: ${narration}`);
  return parsed;
}

describe("quorums-and-n-r-w content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("quorums-and-n-r-w");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("quorums-and-n-r-w");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("sync write latency steps with the quorum", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const one = runPreset(preset, { ...MIX, mode: "sync", quorum: "one" });
    const majority = runPreset(preset, { ...MIX, mode: "sync", quorum: "majority" });
    const all = runPreset(preset, { ...MIX, mode: "sync", quorum: "all" });
    expect(majority.p99).toBeGreaterThan(one.p99 * 2);
    expect(all.p99).toBeGreaterThan(majority.p99 * 2);
  });

  it("async reads go stale across lagged replicas", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, { ...MIX, mode: "async", quorum: "majority" });
    expect(staleOf(result.narration)).toBeGreaterThan(0);
  });
});
