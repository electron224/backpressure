// packages/sim-core/tests/retry-traffic.test.ts
import { describe, expect, it } from "vitest";
import { compile, run } from "../src/engine.js";
import type { HandlerFn } from "../src/engine.js";
import type { TrafficProfile } from "../src/index.js";

function ids(seed: number, retryRatio?: number): number[] {
  const graph = compile({ nodes: [{ id: "a", kind: "echo", config: {} }], edges: [] });
  const seen: number[] = [];
  const onA: HandlerFn = (e, ctx) => {
    const payload: unknown = e.payload;
    if (typeof payload === "object" && payload !== null && "id" in payload) {
      const id: unknown = payload.id;
      if (typeof id === "number") seen.push(id);
    }
    ctx.complete(e.at + 5, 5, true);
  };
  const handlers = new Map<string, HandlerFn>([["a", onA]]);
  const traffic: TrafficProfile =
    retryRatio === undefined ? { rps: 50, durationMs: 2000 } : { rps: 50, durationMs: 2000, retryRatio };
  run({ seed, graph, traffic, handlers });
  return seen;
}

describe("retryRatio", () => {
  it("sends no duplicates when off", () => {
    const sample = ids(4);
    expect(new Set(sample).size).toBe(sample.length);
  });

  it("repeats ids deterministically when on", () => {
    const first = ids(4, 0.3);
    expect(first.length).toBeGreaterThan(new Set(first).size);
    expect(ids(4, 0.3)).toEqual(first);
  });
});
