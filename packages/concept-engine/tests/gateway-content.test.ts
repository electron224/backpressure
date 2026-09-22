// packages/concept-engine/tests/gateway-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import type { PresetValues, Topology } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset } from "../../../content/concepts/reverse-proxy-vs-api-gateway/lab.js";

const DIR = "content/concepts/reverse-proxy-vs-api-gateway";

function variant(label: string): { topology: Topology; values: PresetValues } {
  const preset = LabPresetSchema.parse(labPreset);
  const found = preset.variants?.find((v) => v.label === label);
  if (found?.topology === undefined) throw new Error(`missing variant ${label}`);
  return { topology: found.topology, values: { rps: 80 } };
}

describe("gateway content", () => {
  it("validates + word count", () => {
    const preset = LabPresetSchema.parse(labPreset);
    expect(preset.variants).toHaveLength(2);
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("reverse-proxy-vs-api-gateway");
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(3);
    const words = readFileSync(`${DIR}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });

  it("proxy saturates at 250 while gateway sheds clean", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const proxy = variant("proxy");
    const gateway = variant("gateway");
    const proxyRun = runPreset({ ...preset, topology: proxy.topology }, { rps: 250 });
    const gatewayRun = runPreset({ ...preset, topology: gateway.topology }, { rps: 250 });
    expect(proxyRun.verdict).toBe("FAIL");
    expect(gatewayRun.verdict).toBe("PASS");
    expect(gatewayRun.rejected).toBeGreaterThan(0);
    expect(gatewayRun.narration).toContain("dropped=0");
  });

  it("killing the gateway limiter is total outage", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const gateway = variant("gateway");
    const result = runPreset({ ...preset, topology: gateway.topology }, { rps: 80 }, { dropBackend: "gw" });
    expect(result.verdict).toBe("FAIL");
    expect(result.narration).toContain("all backends down");
  });
});
