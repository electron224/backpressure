// packages/concept-engine/tests/tier5-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset as mq } from "../../../content/concepts/message-queues-vs-streams/lab.js";
import { labPreset as pubsub } from "../../../content/concepts/pub-sub/lab.js";
import { labPreset as bp } from "../../../content/concepts/backpressure-and-dlq/lab.js";
import { labPreset as fw } from "../../../content/concepts/fan-out-on-write-vs-read/lab.js";
import { labPreset as cdc } from "../../../content/concepts/cdc-and-outbox/lab.js";

const CONCEPTS = [
  { slug: "message-queues-vs-streams", preset: mq, challenges: 1, recallMin: 3 },
  { slug: "pub-sub", preset: pubsub, challenges: 1, recallMin: 3 },
  { slug: "backpressure-and-dlq", preset: bp, challenges: 1, recallMin: 3 },
  { slug: "fan-out-on-write-vs-read", preset: fw, challenges: 1, recallMin: 3 },
  { slug: "cdc-and-outbox", preset: cdc, challenges: 1, recallMin: 3 },
] as const;

describe("tier-5 content files", () => {
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

  it("queue absorbs the 250 burst without drops", () => {
    const preset = LabPresetSchema.parse(mq);
    const queuedTopo = preset.variants?.find((v) => v.label === "queued")?.topology ?? preset.topology;
    const directTopo = preset.variants?.find((v) => v.label === "direct")?.topology;
    if (directTopo === undefined) throw new Error("missing direct variant");
    const result = runPreset({ ...preset, topology: queuedTopo }, { rps: 250 });
    expect(result.rejected).toBe(0);
    const shed = runPreset({ ...preset, topology: directTopo }, { rps: 250 });
    expect(shed.rejected).toBeGreaterThan(0);
  });

  it("slow subscriber sheds alone", () => {
    const preset = LabPresetSchema.parse(pubsub);
    const result = runPreset(preset, { rps: 100 });
    expect(result.narration).toContain("q-slow");
    expect(result.rejected).toBeGreaterThan(0);
  });

  it("flood explodes depth with DLQ poison", () => {
    const preset = LabPresetSchema.parse(bp);
    const result = runPreset(preset, { rps: 150 });
    expect(result.narration).toContain("dlq=");
    expect(result.narration).not.toContain("dlq=0");
  });

  it("write share scales origin load 4x", () => {
    const preset = LabPresetSchema.parse(fw);
    const servedOf = (narration: string): number =>
      [...narration.matchAll(/t\d: served=(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    const heavy = servedOf(runPreset(preset, { rps: 80, writePct: 50 }).narration);
    const light = servedOf(runPreset(preset, { rps: 80, writePct: 0 }).narration);
    expect(heavy).toBeGreaterThan(light * 1.5);
  });

  it("killing the relay diverges ledger from sink", () => {
    const preset = LabPresetSchema.parse(cdc);
    const result = runPreset(preset, { rps: 80, writePct: 100 }, { dropBackend: "relay" });
    const ledger = Number(result.narration.match(/ledger: served=(\d+)/)?.[1] ?? "NaN");
    const sink = Number(result.narration.match(/sink: served=(\d+)/)?.[1] ?? "NaN");
    expect(ledger).toBeGreaterThan(0);
    expect(sink).toBe(0);
  });
});
