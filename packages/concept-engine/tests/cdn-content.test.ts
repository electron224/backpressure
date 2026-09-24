// packages/concept-engine/tests/cdn-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/cdn/lab.js";

const DIR = "content/concepts/cdn";

function variant(label: string): { topology: import("../src/schema.js").Topology } {
  const preset = LabPresetSchema.parse(labPreset);
  if (label === "edge") return { topology: preset.topology };
  const found = preset.variants?.find((v) => v.label === label);
  if (found?.topology === undefined) throw new Error(`missing variant ${label}`);
  return { topology: found.topology };
}

describe("cdn content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.variants).toHaveLength(2);
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("cdn");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("edge holds 220 while direct collapses", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const edge = runPreset({ ...preset, topology: variant("edge").topology }, { rps: 220 });
    const direct = runPreset({ ...preset, topology: variant("direct").topology }, { rps: 220 });
    expect(edge.verdict).toBe("PASS");
    expect(direct.verdict).toBe("FAIL");
    expect(direct.p99).toBeGreaterThan(edge.p99 * 2);
  });

  it("TTL 1s over 10k keys collapses the shield at 220", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const collapsed = runPreset(
      { ...preset, topology: variant("edge").topology },
      { rps: 220, "edge.ttlMs": 1000, "edge.keySpace": 10_000 },
    );
    expect(collapsed.verdict).toBe("FAIL");
  });
});
