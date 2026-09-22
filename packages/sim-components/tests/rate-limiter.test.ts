// packages/sim-components/tests/rate-limiter.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue, createRng } from "@backpressure/sim-core";
import type { EngineContext } from "@backpressure/sim-core";
import { createRateLimiter } from "../src/rate-limiter.js";

function testContext(): EngineContext & { failed: number } {
  const box = { failed: 0 };
  const queue = new EventQueue();
  const context: EngineContext = {
    now: 0,
    queue,
    rng: createRng(1),
    complete: (_at: number, _lat: number, ok: boolean) => {
      if (!ok) box.failed += 1;
    },
  };
  return Object.assign(context, box);
}

function fire(
  handler: (event: never, ctx: EngineContext) => void,
  ctx: EngineContext,
  at: number,
  seq: number,
): void {
  ctx.now = at;
  handler({ at, seq, kind: "request", targetId: "lim" } as never, ctx);
}

describe("token-bucket", () => {
  it("absorbs burst 20, rejects 21st, refills over virtual time", () => {
    const lim = createRateLimiter("lim", { algorithm: "token-bucket", rps: 100, burst: 20 }, "svc");
    const ctx = testContext();
    for (let i = 0; i < 21; i += 1) fire(lim.handler, ctx, 0, i);
    expect(lim.metrics()).toEqual({ allowed: 20, rejected: 1 });
    for (let i = 0; i < 11; i += 1) fire(lim.handler, ctx, 100, 21 + i);
    expect(lim.metrics()).toEqual({ allowed: 30, rejected: 2 });
  });

  it("is deterministic for identical sequences", () => {
    const runOnce = (): { allowed: number; rejected: number } => {
      const lim = createRateLimiter("lim", { algorithm: "token-bucket", rps: 100, burst: 20 }, "svc");
      const ctx = testContext();
      [0, 0, 5, 50, 500, 500, 500].forEach((at, i) => fire(lim.handler, ctx, at, i));
      return lim.metrics();
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe("sliding-window", () => {
  it("caps each 1s window and double-admits across the edge", () => {
    const lim = createRateLimiter("lim", { algorithm: "sliding-window", rps: 100, burst: 100 }, "svc");
    const ctx = testContext();
    for (let i = 0; i < 100; i += 1) fire(lim.handler, ctx, 999, i);
    for (let i = 0; i < 100; i += 1) fire(lim.handler, ctx, 1000, 100 + i);
    expect(lim.metrics()).toEqual({ allowed: 200, rejected: 0 });
    fire(lim.handler, ctx, 1001, 200);
    expect(lim.metrics().rejected).toBe(1);
  });
});
