// packages/sim-components/tests/cache.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue, createRng } from "@backpressure/sim-core";
import type { EngineContext } from "@backpressure/sim-core";
import { createCache } from "../src/cache.js";

function testContext(): EngineContext {
  return { now: 0, queue: new EventQueue(), rng: createRng(1), complete: () => {} };
}

function fire(
  handler: (event: never, ctx: EngineContext) => void,
  ctx: EngineContext,
  at: number,
  seq: number,
): void {
  ctx.now = at;
  handler({ at, seq, kind: "request", targetId: "edge" } as never, ctx);
}

describe("cache", () => {
  it("hits on repeats within TTL, misses past it", () => {
    const cache = createCache("edge", { ttlMs: 60_000, capacity: 1000, keySpace: 10, hitMs: 2 }, "origin");
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 0, i);
    expect(cache.metrics()).toEqual({ hits: 0, misses: 10 });
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 1000, 10 + i);
    expect(cache.metrics()).toEqual({ hits: 10, misses: 10 });
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 61_000, 20 + i);
    expect(cache.metrics().misses).toBe(20);
  });

  it("evicts oldest past capacity", () => {
    const cache = createCache("edge", { ttlMs: 60_000, capacity: 5, keySpace: 10, hitMs: 2 }, "origin");
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 0, i);
    fire(cache.handler, ctx, 1000, 10);
    expect(cache.metrics()).toEqual({ hits: 0, misses: 11 });
  });

  it("reset clears everything (cold restart)", () => {
    const cache = createCache("edge", { ttlMs: 60_000, capacity: 1000, keySpace: 10, hitMs: 2 }, "origin");
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 0, i);
    cache.reset();
    expect(cache.metrics()).toEqual({ hits: 0, misses: 0 });
    fire(cache.handler, ctx, 1000, 10);
    expect(cache.metrics()).toEqual({ hits: 0, misses: 1 });
  });

  it("is deterministic for identical sequences", () => {
    const runOnce = (): { hits: number; misses: number } => {
      const cache = createCache("edge", { ttlMs: 5000, capacity: 100, keySpace: 7, hitMs: 2 }, "origin");
      const ctx = testContext();
      [0, 100, 900, 1100, 6000, 6100].forEach((at, i) => fire(cache.handler, ctx, at, i));
      return cache.metrics();
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
