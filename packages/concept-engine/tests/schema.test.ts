// packages/concept-engine/tests/schema.test.ts
import { describe, expect, it } from "vitest";
import { ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";

describe("ConceptMetaSchema", () => {
  it("accepts a valid meta", () => {
    const parsed = ConceptMetaSchema.parse({
      id: "load-balancing",
      title: "Load Balancing",
      prerequisites: [],
      difficulty: "beginner",
      estimated_minutes: 20,
      tags: ["traffic"],
    });
    expect(parsed.id).toBe("load-balancing");
  });

  it("rejects a bad difficulty", () => {
    expect(() =>
      ConceptMetaSchema.parse({
        id: "x",
        title: "X",
        prerequisites: [],
        difficulty: "expert",
        estimated_minutes: 5,
        tags: [],
      }),
    ).toThrow();
  });
});

describe("ChallengesSchema", () => {
  it("rejects an empty list", () => {
    expect(() => ChallengesSchema.parse([])).toThrow();
  });
});

describe("RecallItemsSchema", () => {
  it("rejects an item missing an answer", () => {
    expect(() => RecallItemsSchema.parse([{ id: "r1", q: "Why?" }])).toThrow();
  });
});
