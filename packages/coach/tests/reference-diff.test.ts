// packages/coach/tests/reference-diff.test.ts
import { describe, expect, it } from "vitest";
import { diffAgainstReference, summarizeDiff } from "../src/reference-diff.js";
import type { Topology } from "@backpressure/concept-engine";

const REFERENCE: Topology = {
  nodes: [
    { id: "lim", kind: "rate-limiter", config: {} },
    { id: "edge", kind: "cache", config: {} },
    { id: "lb", kind: "lb", config: {} },
    { id: "api-a", kind: "service", config: {} },
    { id: "api-b", kind: "service", config: {} },
  ],
  edges: [
    { from: "lim", to: "edge" },
    { from: "edge", to: "lb" },
    { from: "lb", to: "api-a" },
    { from: "lb", to: "api-b" },
  ],
};

describe("diffAgainstReference", () => {
  it("empty diff when the mix matches, whatever the ids", () => {
    const theirs: Topology = {
      nodes: [
        { id: "whatever", kind: "lb", config: {} },
        { id: "s1", kind: "service", config: {} },
        { id: "s2", kind: "service", config: {} },
        { id: "c", kind: "cache", config: {} },
        { id: "r", kind: "rate-limiter", config: {} },
      ],
      edges: [],
    };
    expect(diffAgainstReference(theirs, REFERENCE).entries).toEqual([]);
    expect(summarizeDiff(diffAgainstReference(theirs, REFERENCE))).toContain("Same component mix");
  });

  it("flags missing cache and the second service", () => {
    const bare: Topology = {
      nodes: [
        { id: "lb", kind: "lb", config: {} },
        { id: "api", kind: "service", config: {} },
      ],
      edges: [],
    };
    const diff = diffAgainstReference(bare, REFERENCE);
    expect(diff.missingKinds.slice().sort()).toEqual(["cache", "rate-limiter", "service"]);
    const cacheEntry = diff.entries.find((entry) => entry.kind === "cache");
    expect(cacheEntry?.side).toBe("only-reference");
    expect(cacheEntry?.why).toContain("staleness");
    expect(summarizeDiff(diff)).toContain("3 component differences");
  });

  it("flags extra components as design choices", () => {
    const extra: Topology = {
      nodes: [...REFERENCE.nodes, { id: "q", kind: "queue", config: {} }],
      edges: [],
    };
    const diff = diffAgainstReference(extra, REFERENCE);
    expect(diff.extraKinds).toEqual(["queue"]);
    expect(diff.entries.every((entry) => entry.kind !== "queue" || entry.side === "only-yours")).toBe(true);
    expect(diff.entries.find((entry) => entry.kind === "queue")?.why).toContain("backpressure");
  });

  it("handles duplicate kinds pairwise", () => {
    const triple: Topology = {
      nodes: [
        { id: "lb", kind: "lb", config: {} },
        { id: "s1", kind: "service", config: {} },
        { id: "s2", kind: "service", config: {} },
        { id: "s3", kind: "service", config: {} },
        { id: "s4", kind: "service", config: {} },
      ],
      edges: [],
    };
    const diff = diffAgainstReference(triple, REFERENCE);
    expect(diff.extraKinds).toEqual(["service", "service"]);
  });
});
