// packages/concept-engine/tests/rate-limiting-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/rate-limiting/lab.js";

const DIR = "content/concepts/rate-limiting";

describe("rate-limiting content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("rate-limiting");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("rate-limiting");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("admits everything at 80 RPS", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, { algorithm: "token-bucket", rps: 80 });
    expect(result.rejected).toBe(0);
  });

  it("sheds at 150 RPS with service drops at 0", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, { algorithm: "token-bucket", rps: 150 });
    expect(result.rejected).toBeGreaterThan(0);
    expect(result.narration).toContain("dropped=0");
  });

  it("bigger burst rejects less at sustained overload", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const tight = runPreset(preset, { algorithm: "token-bucket", rps: 150, "lim.burst": 20 });
    const loose = runPreset(preset, { algorithm: "token-bucket", rps: 150, "lim.burst": 100 });
    expect(loose.rejected).toBeLessThan(tight.rejected);
  });
});
