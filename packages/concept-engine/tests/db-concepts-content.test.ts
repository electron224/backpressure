// packages/concept-engine/tests/db-concepts-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LabPresetSchema, ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";
import { labPreset as sqlVsNosql } from "../../../content/concepts/sql-vs-nosql/lab.js";
import { labPreset as indexing } from "../../../content/concepts/indexing/lab.js";

function checkFiles(dir: string, id: string, challengeCount: number, recallMin: number): void {
  const meta: unknown = JSON.parse(readFileSync(`${dir}/meta.json`, "utf8"));
  expect(ConceptMetaSchema.parse(meta).id).toBe(id);
  const challenges: unknown = JSON.parse(readFileSync(`${dir}/challenges.json`, "utf8"));
  expect(ChallengesSchema.parse(challenges)).toHaveLength(challengeCount);
  const recall: unknown = JSON.parse(readFileSync(`${dir}/recall.json`, "utf8"));
  expect(RecallItemsSchema.parse(recall).length).toBeGreaterThanOrEqual(recallMin);
  const words = readFileSync(`${dir}/learn.mdx`, "utf8").split(/\s+/).filter((w: string) => w.length > 0);
  expect(words.length).toBeLessThanOrEqual(600);
}

function variantTopo(slug: "sql-vs-nosql" | "indexing", label: string): import("../src/schema.js").Topology {
  const preset = LabPresetSchema.parse(slug === "sql-vs-nosql" ? sqlVsNosql : indexing);
  const found = preset.variants?.find((v) => v.label === label);
  if (found?.topology === undefined) throw new Error(`missing variant ${label}`);
  return found.topology;
}

describe("sql-vs-nosql content", () => {
  it("validates + word count", () => {
    expect(LabPresetSchema.parse(sqlVsNosql).id).toBe("sql-vs-nosql");
    checkFiles("content/concepts/sql-vs-nosql", "sql-vs-nosql", 2, 3);
  });

  it("write share compounds the gap, low writes hide it", () => {
    const preset = LabPresetSchema.parse(sqlVsNosql);
    const sqlHeavy = runPreset({ ...preset, topology: variantTopo("sql-vs-nosql", "sql") }, { rps: 80, writePct: 50 });
    const nosqlHeavy = runPreset({ ...preset, topology: variantTopo("sql-vs-nosql", "nosql") }, { rps: 80, writePct: 50 });
    expect(sqlHeavy.p99).toBeGreaterThan(nosqlHeavy.p99 * 2);
    const sqlLight = runPreset({ ...preset, topology: variantTopo("sql-vs-nosql", "sql") }, { rps: 80, writePct: 0 });
    const nosqlLight = runPreset({ ...preset, topology: variantTopo("sql-vs-nosql", "nosql") }, { rps: 80, writePct: 0 });
    expect(sqlLight.p99 / nosqlLight.p99).toBeLessThan(sqlHeavy.p99 / nosqlHeavy.p99);
  });
});

describe("indexing content", () => {
  it("validates + word count", () => {
    expect(LabPresetSchema.parse(indexing).id).toBe("indexing");
    checkFiles("content/concepts/indexing", "indexing", 2, 3);
  });

  it("indexed wins reads and holds load the heap cannot", () => {
    const preset = LabPresetSchema.parse(indexing);
    const indexedRead = runPreset({ ...preset, topology: variantTopo("indexing", "indexed") }, { rps: 80, writePct: 5 });
    const heapRead = runPreset({ ...preset, topology: variantTopo("indexing", "heap") }, { rps: 80, writePct: 5 });
    expect(heapRead.p99).toBeGreaterThan(indexedRead.p99 * 3);
    const indexedHot = runPreset({ ...preset, topology: variantTopo("indexing", "indexed") }, { rps: 150, writePct: 5 });
    const heapHot = runPreset({ ...preset, topology: variantTopo("indexing", "heap") }, { rps: 150, writePct: 5 });
    expect(indexedHot.verdict).toBe("PASS");
    expect(heapHot.verdict).toBe("FAIL");
  });
});
