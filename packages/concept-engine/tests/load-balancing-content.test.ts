// packages/concept-engine/tests/load-balancing-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";

// NOTE: brief specified "../../content/..." here, but readFileSync resolves
// relative to process.cwd() (repo root under `pnpm vitest run`), where that
// path escapes the repo. Root-relative DIR is the minimal fix.
const DIR = "content/concepts/load-balancing";

describe("load-balancing content", () => {
  it("meta validates", () => {
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("load-balancing");
  });

  it("challenges validate", () => {
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
  });

  it("recall validates", () => {
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall)).toHaveLength(4);
  });

  it("learn.mdx is under 600 words", () => {
    const mdx = readFileSync(`${DIR}/learn.mdx`, "utf8");
    const words = mdx.split(/\s+/).filter((w) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });
});
