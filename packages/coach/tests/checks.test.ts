// packages/coach/tests/checks.test.ts
import { describe, expect, it } from "vitest";
import { runChecks } from "../src/checks.js";
import type { Topology } from "@backpressure/concept-engine";

const single: Topology = {
  nodes: [{ id: "web", kind: "service", config: {} }],
  edges: [],
};

const replicated: Topology = {
  nodes: [
    { id: "lb", kind: "lb", config: {} },
    { id: "a", kind: "service", config: {} },
    { id: "b", kind: "service", config: {} },
  ],
  edges: [
    { from: "lb", to: "a" },
    { from: "lb", to: "b" },
  ],
};

const cachedDb: Topology = {
  nodes: [
    { id: "edge", kind: "cache", config: {} },
    { id: "db", kind: "database", config: {} },
  ],
  edges: [{ from: "edge", to: "db" }],
};

describe("structural checks", () => {
  it("flags single service, passes replicated", () => {
    const [fail] = runChecks(single, ["no_single_point_of_failure"]);
    expect(fail?.passed).toBe(false);
    const [pass] = runChecks(replicated, ["no_single_point_of_failure"]);
    expect(pass?.passed).toBe(true);
  });

  it("requires cache ancestors for databases", () => {
    const [fail] = runChecks(
      { nodes: [{ id: "db", kind: "database", config: {} }], edges: [] },
      ["cache_between_app_and_db"],
    );
    expect(fail?.passed).toBe(false);
    const [pass] = runChecks(cachedDb, ["cache_between_app_and_db"]);
    expect(pass?.passed).toBe(true);
  });

  it("throws on unknown check ids", () => {
    expect(() => runChecks(single, ["nope"])).toThrow(/unknown structural check/i);
  });
});
