// packages/concept-engine/tests/cap-theorem-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/cap-theorem/lab.js";

const DIR = "content/concepts/cap-theorem";
const VALUES = { rps: 80, writePct: 20, skewPct: 120 };

function staleOf(narration: string): number {
  const match = narration.match(/stale=(\d+)/);
  const parsed = match?.[1] === undefined ? NaN : Number(match[1]);
  if (!Number.isInteger(parsed)) throw new Error(`no stale count in: ${narration}`);
  return parsed;
}

describe("cap-theorem content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("cap-theorem");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("cap-theorem");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("AP flows stale through the partition, CP fails clean", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const ap = runPreset(preset, { ...VALUES, mode: "async" });
    const cp = runPreset(preset, { ...VALUES, mode: "sync" });
    expect(staleOf(ap.narration)).toBeGreaterThan(0);
    expect(staleOf(cp.narration)).toBe(0);
    expect(cp.rejected).toBeGreaterThan(0);
  });
});
