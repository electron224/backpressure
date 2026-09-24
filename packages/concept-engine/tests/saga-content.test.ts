// packages/concept-engine/tests/saga-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/distributed-transactions-and-saga/lab.js";

const DIR = "content/concepts/distributed-transactions-and-saga";

describe("distributed-transactions-and-saga content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.id).toBe("distributed-transactions-and-saga");
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("distributed-transactions-and-saga");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("full chain ships everything", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, { rps: 80 });
    expect(result.verdict).toBe("PASS");
    expect(result.narration).toContain("order->pay");
  });

  it("killing pay leaves order completed and nothing shipped", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, { rps: 80 }, { dropBackend: "pay" });
    expect(result.narration).toContain("order->pay");
    expect(result.narration).toContain("ship: served=0");
  });
});
