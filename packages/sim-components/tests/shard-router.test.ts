// packages/sim-components/tests/shard-router.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue, createRng } from "@backpressure/sim-core";
import type { EngineContext } from "@backpressure/sim-core";
import { createShardRouter } from "../src/shard-router.js";

function testContext(): EngineContext {
  return { now: 0, queue: new EventQueue(), rng: createRng(1), complete: () => {} };
}

function fire(
  handler: (event: never, ctx: EngineContext) => void,
  ctx: EngineContext,
  key: number,
  seq: number,
): void {
  ctx.now = seq;
  handler({ at: seq, seq, kind: "request", targetId: "router", payload: { key } } as never, ctx);
}

function targets(ctx: EngineContext): string[] {
  const out: string[] = [];
  let e = ctx.queue.pop();
  while (e !== undefined) {
    out.push(e.targetId);
    e = ctx.queue.pop();
  }
  return out;
}

describe("shard-router", () => {
  it("routes by key mod shard count", () => {
    const router = createShardRouter("router", ["s0", "s1", "s2", "s3"]);
    const ctx = testContext();
    fire(router.handler, ctx, 0, 0);
    fire(router.handler, ctx, 1, 1);
    fire(router.handler, ctx, 5, 2);
    expect(targets(ctx)).toEqual(["s0", "s1", "s1"]);
  });

  it("falls back to cyclic keys without payload", () => {
    const router = createShardRouter("router", ["s0", "s1"]);
    const ctx = testContext();
    ctx.now = 0;
    router.handler({ at: 0, seq: 0, kind: "request", targetId: "router" } as never, ctx);
    ctx.now = 1;
    router.handler({ at: 1, seq: 1, kind: "request", targetId: "router" } as never, ctx);
    expect(targets(ctx)).toEqual(["s0", "s1"]);
  });

  it("throws on empty shards and passes writes through", () => {
    expect(() => createShardRouter("router", [])).toThrow(/shard/i);
    const router = createShardRouter("router", ["s0"]);
    const ctx = testContext();
    ctx.now = 0;
    router.handler({ at: 0, seq: 0, kind: "write", targetId: "router", payload: { key: 7 } } as never, ctx);
    expect(targets(ctx)).toEqual(["s0"]);
  });

  it("is deterministic for identical sequences", () => {
    const runOnce = (): string => {
      const router = createShardRouter("router", ["s0", "s1", "s2", "s3"]);
      const ctx = testContext();
      [3, 3, 9, 0, 14].forEach((key, i) => fire(router.handler, ctx, key, i));
      return targets(ctx).join(",");
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
