// packages/canvas/tests/compiler.test.ts
import { describe, expect, it } from "vitest";
import { compileFlow, paletteKinds } from "../src/compiler.js";

describe("compileFlow", () => {
  it("compiles LB preset nodes with defaults", () => {
    const topology = compileFlow(
      [
        { id: "lb", kind: "lb", config: {} },
        { id: "web", kind: "service", config: {} },
      ],
      [{ from: "lb", to: "web" }],
    );
    expect(topology.nodes).toHaveLength(2);
    expect(topology.edges).toHaveLength(1);
  });

  it("rejects unknown kinds, dup ids, dangling edges", () => {
    expect(() => compileFlow([{ id: "x", kind: "cdn", config: {} }], [])).toThrow(/unknown node kind/i);
    expect(() =>
      compileFlow(
        [
          { id: "a", kind: "service", config: {} },
          { id: "a", kind: "service", config: {} },
        ],
        [],
      ),
    ).toThrow(/duplicate/i);
    expect(() => compileFlow([{ id: "a", kind: "service", config: {} }], [{ from: "a", to: "ghost" }])).toThrow(
      /unknown edge target/i,
    );
  });

  it("palette covers every simulatable kind", () => {
    for (const kind of ["lb", "service", "rate-limiter", "cache", "database", "shard-router", "dedup", "pipe", "queue", "fan-out"]) {
      expect(paletteKinds()).toContain(kind);
    }
  });
});
