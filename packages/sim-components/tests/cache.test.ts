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

function writeAt(
  handler: (event: never, ctx: EngineContext) => void,
  ctx: EngineContext,
  at: number,
  seq: number,
): void {
  ctx.now = at;
  handler({ at, seq, kind: "write", targetId: "edge" } as never, ctx);
}

describe("write policies", () => {
  it("aside invalidates: write then read misses", () => {
    const cache = createCache("edge", { ttlMs: 60_000, capacity: 1000, keySpace: 10, hitMs: 2 }, "origin");
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 0, i);
    writeAt(cache.handler, ctx, 500, 10);
    for (let i = 0; i < 9; i += 1) fire(cache.handler, ctx, 1000, 11 + i);
    fire(cache.handler, ctx, 1000, 20);
    expect(cache.metrics()).toEqual({ hits: 9, misses: 11 });
  });

  it("through refreshes: write then read hits", () => {
    const cache = createCache(
      "edge",
      { ttlMs: 60_000, capacity: 1000, keySpace: 10, hitMs: 2, writePolicy: "through" },
      "origin",
    );
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 0, i);
    writeAt(cache.handler, ctx, 500, 10);
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 1000, 11 + i);
    expect(cache.metrics()).toEqual({ hits: 10, misses: 10 });
  });

  it("behind acks fast and coalesces flushes", () => {
    const cache = createCache(
      "edge",
      { ttlMs: 60_000, capacity: 1000, keySpace: 10, hitMs: 2, writePolicy: "behind", flushMs: 1000 },
      "origin",
    );
    const forwarded: string[] = [];
    const ctx = testContext();
    const inner = ctx.queue.push.bind(ctx.queue);
    ctx.queue.push = (at: number, kind: string, target: string, payload?: unknown): void => {
      if (target === "origin") forwarded.push(`${kind}@${at}`);
      inner(at, kind, target, payload);
    };
    writeAt(cache.handler, ctx, 0, 0);
    writeAt(cache.handler, ctx, 10, 1);
    writeAt(cache.handler, ctx, 20, 2);
    expect(forwarded.filter((f) => f.startsWith("write@"))).toHaveLength(0);
    const flush = ctx.queue.pop();
    if (!flush) throw new Error("expected a flush event");
    ctx.now = flush.at;
    cache.handler(flush as never, ctx);
    const originWrites = forwarded.filter((f) => f.startsWith("write@"));
    expect(originWrites).toHaveLength(1);
  });

  it("ahead revalidates near-expiry hits", () => {
    const cache = createCache(
      "edge",
      { ttlMs: 10_000, capacity: 1000, keySpace: 10, hitMs: 2, writePolicy: "ahead", refreshMarginMs: 5000 },
      "origin",
    );
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 0, i);
    for (let i = 0; i < 10; i += 1) fire(cache.handler, ctx, 6000, 10 + i);
    expect(cache.metrics().misses).toBe(20);
    fire(cache.handler, ctx, 7000, 20);
    expect(cache.metrics().hits).toBe(1);
  });
});
