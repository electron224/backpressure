// packages/sim-core/tests/zipf-keys.test.ts
import { describe, expect, it } from "vitest";
import { compile, run } from "../src/engine.js";
import type { HandlerFn } from "../src/engine.js";
import type { TrafficProfile } from "../src/index.js";

function keys(seed: number, keyAlpha: number, keySpace: number): number[] {
  const graph = compile({ nodes: [{ id: "a", kind: "echo", config: {} }], edges: [] });
  const seen: number[] = [];
  const onA: HandlerFn = (e, ctx) => {
    const payload: unknown = e.payload;
    if (typeof payload === "object" && payload !== null && "key" in payload) {
      const key: unknown = payload.key;
      if (typeof key === "number") seen.push(key);
    }
    ctx.complete(e.at + 5, 5, true);
  };
  const handlers = new Map<string, HandlerFn>([["a", onA]]);
  const traffic: TrafficProfile = { rps: 200, durationMs: 2000, keyAlpha, keySpace };
  run({ seed, graph, traffic, handlers });
  return seen;
}

describe("zipf keyed arrivals", () => {
  it("stays keyless without alpha/space (legacy payloads)", () => {
    const graph = compile({ nodes: [{ id: "a", kind: "echo", config: {} }], edges: [] });
    const payloads: unknown[] = [];
    const onA: HandlerFn = (e, ctx) => {
      payloads.push(e.payload);
      ctx.complete(e.at + 5, 5, true);
    };
    run({ seed: 5, graph, traffic: { rps: 50, durationMs: 1000 }, handlers: new Map([["a", onA]]) });
    expect(payloads.length).toBeGreaterThan(0);
    for (const p of payloads) expect(p).not.toHaveProperty("key");
  });

  it("is deterministic for the same seed", () => {
    expect(keys(9, 1.2, 100)).toEqual(keys(9, 1.2, 100));
  });

  it("skews hotter with higher alpha", () => {
    const hot = (sample: number[]): number => {
      const counts = new Map<number, number>();
      for (const k of sample) counts.set(k, (counts.get(k) ?? 0) + 1);
      return Math.max(...counts.values());
    };
    const spread = (sample: number[]): number => {
      const counts = new Map<number, number>();
      for (const k of sample) counts.set(k, (counts.get(k) ?? 0) + 1);
      const values = [...counts.values()];
      return Math.max(...values) - Math.min(...values);
    };
    const skewed = keys(9, 1.5, 100);
    const flat = keys(9, 0, 100);
    expect(hot(skewed)).toBeGreaterThan(hot(flat));
    expect(spread(flat)).toBeLessThan(spread(skewed));
  });
});
