// packages/concept-engine/tests/replication-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/replication/lab.js";

const DIR = "content/concepts/replication";

function staleOf(narration: string): number {
  const match = narration.match(/stale=(\d+)/);
  const parsed = match?.[1] === undefined ? NaN : Number(match[1]);
  if (!Number.isInteger(parsed)) throw new Error(`no stale count in: ${narration}`);
  return parsed;
}

describe("replication content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("replication");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("replication");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("async serves stale with fast p99, sync stays clean but slow", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const values = { rps: 80, writePct: 20, skewPct: 120 };
    const asyncRun = runPreset(preset, { ...values, mode: "async" });
    const syncRun = runPreset(preset, { ...values, mode: "sync" });
    expect(staleOf(asyncRun.narration)).toBeGreaterThan(0);
    expect(staleOf(syncRun.narration)).toBe(0);
    expect(syncRun.p99).toBeGreaterThan(asyncRun.p99 * 2);
  });
});
