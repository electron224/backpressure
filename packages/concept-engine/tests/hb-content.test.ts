// packages/concept-engine/tests/hb-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/health-checks-and-circuit-breakers/lab.js";

const DIR = "content/concepts/health-checks-and-circuit-breakers";

describe("health-checks-and-circuit-breakers content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("health-checks-and-circuit-breakers");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("health-checks-and-circuit-breakers");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("breaker collapses errors and holds p99 at 150", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const on = runPreset(preset, { rps: 150, breaker: "on" });
    const off = runPreset(preset, { rps: 150, breaker: "off" });
    expect(on.verdict).toBe("PASS");
    expect(off.rejected).toBeGreaterThan(on.rejected * 2);
  });
});
