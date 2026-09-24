// packages/concept-engine/tests/tier6-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { estimateCost } from "../src/cost.js";
import { labPreset as observability } from "../../../content/concepts/observability-golden-signals/lab.js";
import { labPreset as slo } from "../../../content/concepts/slo-error-budgets/lab.js";
import { labPreset as graceful } from "../../../content/concepts/graceful-degradation-and-bulkheads/lab.js";
import { labPreset as deploy } from "../../../content/concepts/deployment-strategies/lab.js";
import { labPreset as capacity } from "../../../content/concepts/capacity-and-cost-modelling/lab.js";

const CONCEPTS = [
  { slug: "observability-golden-signals", preset: observability, challenges: 2, recallMin: 3 },
  { slug: "slo-error-budgets", preset: slo, challenges: 2, recallMin: 3 },
  { slug: "graceful-degradation-and-bulkheads", preset: graceful, challenges: 1, recallMin: 3 },
  { slug: "deployment-strategies", preset: deploy, challenges: 2, recallMin: 3 },
  { slug: "capacity-and-cost-modelling", preset: capacity, challenges: 1, recallMin: 3 },
] as const;

describe("tier-6 content files", () => {
  for (const c of CONCEPTS) {
    it(`${c.slug} validates + word count`, () => {
      expect(LabPresetSchema.parse(c.preset).id).toBe(c.slug);
      const dir = `content/concepts/${c.slug}`;
      const meta: unknown = JSON.parse(readFileSync(`${dir}/meta.json`, "utf8"));
      expect(ConceptMetaSchema.parse(meta).id).toBe(c.slug);
      const challenges: unknown = JSON.parse(readFileSync(`${dir}/challenges.json`, "utf8"));
      expect(ChallengesSchema.parse(challenges)).toHaveLength(c.challenges);
      const recall: unknown = JSON.parse(readFileSync(`${dir}/recall.json`, "utf8"));
      expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(c.recallMin);
      const words = readFileSync(`${dir}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
      expect(words.length).toBeLessThanOrEqual(600);
    });
  }

  it("slo burns errors at 150, clean at 90", () => {
    const preset = LabPresetSchema.parse(slo);
    const hot = runPreset(preset, { rps: 150 });
    const cool = runPreset(preset, { rps: 90 });
    expect(hot.rejected).toBeGreaterThan(0);
    expect(cool.rejected).toBe(0);
  });

  it("graceful degrades on kill with survivor clean", () => {
    const preset = LabPresetSchema.parse(graceful);
    const result = runPreset(preset, { rps: 150, breaker: "on" }, { dropBackend: "flaky" });
    expect(result.narration).toContain("fast: served=");
    expect(result.narration).toContain("dropped=0");
  });

  it("canary bounds errors near a tenth, cutover fails all", () => {
    const preset = LabPresetSchema.parse(deploy);
    const canary = preset.variants?.find((v) => v.label === "canary");
    const cutover = preset.variants?.find((v) => v.label === "cutover");
    if (canary?.topology === undefined || cutover?.topology === undefined) throw new Error("missing variants");
    const canaryRun = runPreset({ ...preset, topology: canary.topology }, { rps: 100 });
    const cutoverRun = runPreset({ ...preset, topology: cutover.topology }, { rps: 100 });
    const total = 100 * 5;
    const canaryRate = canaryRun.rejected / total;
    expect(canaryRate).toBeGreaterThan(0.01);
    expect(canaryRate).toBeLessThan(0.2);
    expect(cutoverRun.rejected / total).toBeGreaterThan(0.8);
  });

  it("tall costs less than wide with both passing", () => {
    const preset = LabPresetSchema.parse(capacity);
    const wide = preset.variants?.find((v) => v.label === "wide");
    const tall = preset.variants?.find((v) => v.label === "tall");
    if (wide?.topology === undefined || tall?.topology === undefined) throw new Error("missing variants");
    const wideRun = runPreset({ ...preset, topology: wide.topology }, { rps: 200 });
    const tallRun = runPreset({ ...preset, topology: tall.topology }, { rps: 200 });
    expect(wideRun.verdict).toBe("PASS");
    expect(tallRun.verdict).toBe("PASS");
    const wideCost = estimateCost({ ...preset, topology: wide.topology }, 200).monthlyUsd;
    const tallCost = estimateCost({ ...preset, topology: tall.topology }, 200).monthlyUsd;
    expect(tallCost).toBeLessThan(wideCost);
  });
});
