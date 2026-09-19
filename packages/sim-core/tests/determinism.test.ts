// packages/sim-core/tests/determinism.test.ts
import { describe, expect, it } from "vitest";
import { compile, run } from "../src/index.js";
import type { HandlerFn } from "../src/index.js";

function hashEvents(events: unknown[]): string {
  return JSON.stringify(events);
}

describe("determinism", () => {
  it("same seed gives byte-identical log", () => {
    const graph = compile({
      nodes: [{ id: "a", kind: "echo", config: {} }],
      edges: [],
    });
    const handlers = new Map<string, HandlerFn>([
      ["a", (e, ctx) => {
        ctx.complete(e.at + 5, 5, true);
      }],
    ]);
    const traffic = { rps: 50, durationMs: 2000 };
    const r1 = run({ seed: 99, graph, traffic, handlers });
    const r2 = run({ seed: 99, graph, traffic, handlers });
    expect(hashEvents(r2.eventLog)).toBe(hashEvents(r1.eventLog));
    expect(r2.metrics).toEqual(r1.metrics);
  });
});
