// packages/sim-core/tests/write-traffic.test.ts
import { describe, expect, it } from "vitest";
import { compile, run } from "../src/engine.js";
import type { HandlerFn } from "../src/engine.js";
import type { TrafficProfile } from "../src/index.js";

function kinds(seed: number, writeRatio?: number): string[] {
  const graph = compile({ nodes: [{ id: "a", kind: "echo", config: {} }], edges: [] });
  const seen: string[] = [];
  const onA: HandlerFn = (e, ctx) => {
    seen.push(e.kind);
    ctx.complete(e.at + 5, 5, true);
  };
  const handlers = new Map<string, HandlerFn>([["a", onA]]);
  const traffic: TrafficProfile =
    writeRatio === undefined ? { rps: 50, durationMs: 2000 } : { rps: 50, durationMs: 2000, writeRatio };
  run({ seed, graph, traffic, handlers });
  return seen;
}

describe("writeRatio", () => {
  it("defaults to all reads", () => {
    expect(kinds(11).every((k) => k === "request")).toBe(true);
  });

  it("mixes reads and writes deterministically", () => {
    const first = kinds(11, 0.3);
    expect(first).toContain("write");
    expect(first).toContain("request");
    expect(kinds(11, 0.3)).toEqual(first);
  });
});
