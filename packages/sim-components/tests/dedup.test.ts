// packages/sim-components/tests/dedup.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue, createRng } from "@backpressure/sim-core";
import type { EngineContext } from "@backpressure/sim-core";
import { createDedup } from "../src/dedup.js";

function testContext(): EngineContext & { forwarded: number } {
  const box = { forwarded: 0 };
  const context: EngineContext = {
    now: 0,
    queue: new EventQueue(),
    rng: createRng(1),
    complete: () => {},
  };
  const inner = context.queue.push.bind(context.queue);
  context.queue.push = (at: number, kind: string, target: string, payload?: unknown): void => {
    if (target === "svc") box.forwarded += 1;
    inner(at, kind, target, payload);
  };
  return Object.assign(context, box);
}

function fire(
  handler: (event: never, ctx: EngineContext) => void,
  ctx: EngineContext,
  at: number,
  seq: number,
  id: number,
): void {
  ctx.now = at;
  handler({ at, seq, kind: "request", targetId: "dedup", payload: { id } } as never, ctx);
}

describe("dedup", () => {
  it("drops redeliveries inside the window, forwards after expiry", () => {
    const dedup = createDedup("dedup", { windowMs: 1000 }, "svc");
    const ctx = testContext();
    fire(dedup.handler, ctx, 0, 0, 7);
    fire(dedup.handler, ctx, 10, 1, 7);
    expect(dedup.metrics()).toEqual({ fresh: 1, duplicates: 1 });
    fire(dedup.handler, ctx, 2000, 2, 7);
    expect(dedup.metrics()).toEqual({ fresh: 2, duplicates: 1 });
  });

  it("forwards id-less arrivals untouched", () => {
    const dedup = createDedup("dedup", { windowMs: 1000 }, "svc");
    const ctx = testContext();
    ctx.now = 0;
    dedup.handler({ at: 0, seq: 0, kind: "request", targetId: "dedup" } as never, ctx);
    expect(dedup.metrics()).toEqual({ fresh: 1, duplicates: 0 });
  });

  it("is deterministic for identical sequences", () => {
    const runOnce = (): { fresh: number; duplicates: number } => {
      const dedup = createDedup("dedup", { windowMs: 500 }, "svc");
      const ctx = testContext();
      [[0, 1], [5, 1], [10, 2], [600, 1]].forEach(([at, id], i) =>
        fire(dedup.handler, ctx, at as number, i, id as number),
      );
      return dedup.metrics();
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
