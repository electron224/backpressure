// packages/sim-core/tests/engine.test.ts
import { describe, expect, it } from "vitest";
import { compile } from "../src/engine.js";

describe("compile", () => {
  it("rejects duplicate node ids", () => {
    expect(() =>
      compile({
        nodes: [
          { id: "a", kind: "client", config: {} },
          { id: "a", kind: "service", config: {} },
        ],
        edges: [],
      }),
    ).toThrow(/duplicate/i);
  });

  it("rejects edges to unknown nodes", () => {
    expect(() =>
      compile({
        nodes: [{ id: "a", kind: "client", config: {} }],
        edges: [{ from: "a", to: "missing" }],
      }),
    ).toThrow(/unknown/i);
  });

  it("rejects cycles", () => {
    expect(() =>
      compile({
        nodes: [
          { id: "a", kind: "svc", config: {} },
          { id: "b", kind: "svc", config: {} },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
      }),
    ).toThrow(/cycle/i);
  });
});
