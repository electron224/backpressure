// packages/concept-engine/tests/spof-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/single-point-of-failure/lab.js";

const DIR = "content/concepts/single-point-of-failure";

describe("spof content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.variants).toHaveLength(2);
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("single-point-of-failure");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(1);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("single all-fails on kill, replicated survives", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const single = preset.variants?.[0];
    const replicated = preset.variants?.[1];
    if (!single?.topology || !replicated?.topology) throw new Error("spof variants missing topologies");
    const pre = runPreset({ ...preset, topology: single.topology }, { rps: 80 });
    expect(pre.verdict).toBe("PASS");
    const killed = runPreset({ ...preset, topology: single.topology }, { rps: 80 }, { dropBackend: "web" });
    expect(killed.verdict).toBe("FAIL");
    const survives = runPreset({ ...preset, topology: replicated.topology }, { rps: 80 }, { dropBackend: "web-a" });
    expect(survives.verdict).toBe("PASS");
  });
});
