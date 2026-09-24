// packages/concept-engine/tests/leader-election-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/leader-election-intuition/lab.js";

const DIR = "content/concepts/leader-election-intuition";

function servedOf(narration: string, id: string): number {
  const match = narration.match(new RegExp(`${id}: served=(\\d+)`));
  const parsed = match?.[1] === undefined ? NaN : Number(match[1]);
  if (!Number.isInteger(parsed)) throw new Error(`no served count for ${id} in: ${narration}`);
  return parsed;
}

describe("leader-election-intuition content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("leader-election-intuition");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("leader-election-intuition");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("sticky pins the leader, kill re-seats to the follower", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const pinned = runPreset(preset, { rps: 80, strategy: "sticky", breaker: "on" });
    expect(servedOf(pinned.narration, "leader")).toBeGreaterThan(0);
    expect(servedOf(pinned.narration, "follower")).toBe(0);
    const failed = runPreset(preset, { rps: 80, strategy: "sticky", breaker: "on" }, { dropBackend: "leader" });
    expect(servedOf(failed.narration, "follower")).toBeGreaterThan(0);
    expect(failed.verdict).toBe("PASS");
  });
});
