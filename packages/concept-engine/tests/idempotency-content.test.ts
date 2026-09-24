// packages/concept-engine/tests/idempotency-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/idempotency-and-exactly-once/lab.js";

const DIR = "content/concepts/idempotency-and-exactly-once";

function variant(label: string): import("../src/schema.js").Topology {
  const preset = LabPresetSchema.parse(labPreset);
  const found = preset.variants?.find((v) => v.label === label);
  if (found?.topology === undefined) throw new Error(`missing variant ${label}`);
  return found.topology;
}

function servedOf(narration: string): number {
  const match = narration.match(/api: served=(\d+)/);
  const parsed = match?.[1] === undefined ? NaN : Number(match[1]);
  if (!Number.isInteger(parsed)) throw new Error(`no served count in: ${narration}`);
  return parsed;
}

describe("idempotency-and-exactly-once content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("idempotency-and-exactly-once");
    expect(preset.variants).toHaveLength(2);
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("idempotency-and-exactly-once");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("dedup absorbs retries, direct double-executes", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const values = { rps: 80, retryPct: 30 };
    const deduped = runPreset({ ...preset, topology: variant("deduped") }, values);
    const direct = runPreset({ ...preset, topology: variant("direct") }, values);
    expect(servedOf(direct.narration)).toBeGreaterThan(servedOf(deduped.narration) * 1.1);
    expect(deduped.narration).toContain("duplicates=");
  });

  it("variants converge without retries", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const values = { rps: 80, retryPct: 0 };
    const deduped = servedOf(runPreset({ ...preset, topology: variant("deduped") }, values).narration);
    const direct = servedOf(runPreset({ ...preset, topology: variant("direct") }, values).narration);
    expect(deduped).toBe(direct);
  });
});
