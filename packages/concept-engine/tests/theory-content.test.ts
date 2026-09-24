// packages/concept-engine/tests/theory-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset as pacelc } from "../../../content/concepts/pacelc/lab.js";
import { labPreset as consistencyModels } from "../../../content/concepts/consistency-models/lab.js";

function checkFiles(dir: string, id: string, challengeCount: number, recallMin: number): void {
  const meta: unknown = JSON.parse(readFileSync(`${dir}/meta.json`, "utf8"));
  expect(ConceptMetaSchema.parse(meta).id).toBe(id);
  const challenges: unknown = JSON.parse(readFileSync(`${dir}/challenges.json`, "utf8"));
  expect(ChallengesSchema.parse(challenges)).toHaveLength(challengeCount);
  const recall: unknown = JSON.parse(readFileSync(`${dir}/recall.json`, "utf8"));
  expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(recallMin);
  const words = readFileSync(`${dir}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
  expect(words.length).toBeLessThanOrEqual(600);
}

describe("pacelc content", () => {
  it("validates + word count", () => {
    expect(LabPresetSchema.parse(pacelc).id).toBe("pacelc");
    checkFiles("content/concepts/pacelc", "pacelc", 2, 3);
  });

  it("sync pays lag on writes, async stays fast with stale", () => {
    const base = LabPresetSchema.parse(pacelc);
    const values = { rps: 80, writePct: 20, skewPct: 120, "db.lagMs": 2000 };
    const sync = runPreset(base, { ...values, mode: "sync" });
    const async = runPreset(base, { ...values, mode: "async" });
    expect(sync.p99).toBeGreaterThan(async.p99 * 2);
  });
});

describe("consistency-models content", () => {
  it("validates + word count", () => {
    expect(LabPresetSchema.parse(consistencyModels).id).toBe("consistency-models");
    checkFiles("content/concepts/consistency-models", "consistency-models", 2, 3);
  });

  it("lag 0 is clean, lag 500 goes stale", () => {
    const base = LabPresetSchema.parse(consistencyModels);
    const clean = runPreset(base, { rps: 80, writePct: 20, skewPct: 120, mode: "async", "db.lagMs": 0 });
    const stale = runPreset(base, { rps: 80, writePct: 20, skewPct: 120, mode: "async", "db.lagMs": 500 });
    expect(clean.narration).toContain("stale=0");
    expect(stale.narration).not.toContain("stale=0");
  });
});
