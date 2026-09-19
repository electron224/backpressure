// packages/concept-engine/tests/tier1-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset as latency } from "../../../content/concepts/latency-and-throughput/lab.js";
import { labPreset as scaling } from "../../../content/concepts/vertical-vs-horizontal-scaling/lab.js";
import { labPreset as statelessness } from "../../../content/concepts/statelessness/lab.js";
import { labPreset as estimation } from "../../../content/concepts/back-of-envelope-estimation/lab.js";

function checkFiles(dir: string, id: string, challengeCount: number): void {
  const meta: unknown = JSON.parse(readFileSync(`${dir}/meta.json`, "utf8"));
  expect(ConceptMetaSchema.parse(meta).id).toBe(id);
  const challenges: unknown = JSON.parse(readFileSync(`${dir}/challenges.json`, "utf8"));
  expect(ChallengesSchema.parse(challenges)).toHaveLength(challengeCount);
  const recall: unknown = JSON.parse(readFileSync(`${dir}/recall.json`, "utf8"));
  expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
  const words = readFileSync(`${dir}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
  expect(words.length).toBeLessThanOrEqual(600);
}

describe("latency-and-throughput content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(latency);
    expect(preset.controls.map((c) => c.id).sort()).toEqual(["rps", "web.serviceMs"]);
    checkFiles("content/concepts/latency-and-throughput", "latency-and-throughput", 1);
  });

  it("p99 cliff past the 40 RPS capacity; 20 RPS passes", () => {
    const preset = LabPresetSchema.parse(latency);
    const light = runPreset(preset, { rps: 20 });
    expect(light.verdict).toBe("PASS");
    const heavy = runPreset(preset, { rps: 80 });
    expect(heavy.verdict).toBe("FAIL");
    expect(heavy.p99).toBeGreaterThan(light.p99 * 2);
  });

  it("service-time override moves the cliff", () => {
    const preset = LabPresetSchema.parse(latency);
    const heavy = runPreset(preset, { rps: 80 });
    const faster = runPreset(preset, { rps: 80, "web.serviceMs": 20 });
    expect(faster.verdict).toBe("PASS");
    expect(faster.p99).toBeLessThan(heavy.p99);
  });
});

describe("vertical-vs-horizontal-scaling content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(scaling);
    expect(preset.variants).toHaveLength(2);
    checkFiles("content/concepts/vertical-vs-horizontal-scaling", "vertical-vs-horizontal-scaling", 1);
  });

  it("both shapes pass at 200 RPS and degrade together at 300", () => {
    const preset = LabPresetSchema.parse(scaling);
    const fat = preset.variants?.[0]?.topology;
    const wide = preset.variants?.[1]?.topology;
    if (!fat || !wide) throw new Error("scaling variants missing topologies");
    const fat200 = runPreset({ ...preset, topology: fat }, { rps: 200 });
    const wide200 = runPreset({ ...preset, topology: wide }, { rps: 200 });
    expect(fat200.verdict).toBe("PASS");
    expect(wide200.verdict).toBe("PASS");
    const fat300 = runPreset({ ...preset, topology: fat }, { rps: 300 });
    const wide300 = runPreset({ ...preset, topology: wide }, { rps: 300 });
    expect(fat300.p99).toBeGreaterThan(fat200.p99);
    expect(wide300.p99).toBeGreaterThan(wide200.p99);
  });

  it("wide survives a lost backend; fat does not", () => {
    const preset = LabPresetSchema.parse(scaling);
    const fat = preset.variants?.[0]?.topology;
    const wide = preset.variants?.[1]?.topology;
    if (!fat || !wide) throw new Error("scaling variants missing topologies");
    expect(runPreset({ ...preset, topology: wide }, { rps: 200 }, { dropBackend: "web-1" }).verdict).toBe("PASS");
    expect(runPreset({ ...preset, topology: fat }, { rps: 200 }, { dropBackend: "big" }).verdict).toBe("FAIL");
  });
});

describe("statelessness content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(statelessness);
    expect(preset.controls.find((c) => c.id === "strategy")?.options).toEqual(["sticky", "least-connections"]);
    checkFiles("content/concepts/statelessness", "statelessness", 1);
  });

  it("sticky concentrates the fleet; least-connections spreads it", () => {
    const preset = LabPresetSchema.parse(statelessness);
    const sticky = runPreset(preset, { strategy: "sticky", rps: 80 });
    expect(sticky.verdict).toBe("PASS");
    expect(sticky.narration).toContain("srv-a: served=400");
    expect(sticky.narration).toContain("srv-b: served=0");
    const spread = runPreset(preset, { strategy: "least-connections", rps: 80 });
    expect(spread.verdict).toBe("PASS");
    expect(spread.p99).toBeLessThan(sticky.p99);
  });

  it("past single-backend capacity sticky fails while least-connections holds", () => {
    const preset = LabPresetSchema.parse(statelessness);
    expect(runPreset(preset, { strategy: "sticky", rps: 120 }).verdict).toBe("FAIL");
    expect(runPreset(preset, { strategy: "least-connections", rps: 120 }).verdict).toBe("PASS");
  });

  it("a kill at 80 RPS changes nothing on either row", () => {
    const preset = LabPresetSchema.parse(statelessness);
    expect(runPreset(preset, { strategy: "sticky", rps: 80 }, { dropBackend: "srv-a" }).verdict).toBe("PASS");
    expect(runPreset(preset, { strategy: "least-connections", rps: 80 }, { dropBackend: "srv-a" }).verdict).toBe("PASS");
  });
});

describe("back-of-envelope-estimation content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(estimation);
    checkFiles("content/concepts/back-of-envelope-estimation", "back-of-envelope-estimation", 2);
  });

  it("100 RPS idles; 240 RPS crosses the SLO", () => {
    const preset = LabPresetSchema.parse(estimation);
    const idle = runPreset(preset, { rps: 100 });
    expect(idle.verdict).toBe("PASS");
    const hot = runPreset(preset, { rps: 240 });
    expect(hot.p99).toBeGreaterThan(idle.p99);
    expect(hot.verdict).toBe("FAIL");
  });
});
