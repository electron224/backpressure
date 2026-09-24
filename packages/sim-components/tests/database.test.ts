// packages/sim-components/tests/database.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue, createRng } from "@backpressure/sim-core";
import type { EngineContext } from "@backpressure/sim-core";
import { createDatabase } from "../src/database.js";

function testContext(): EngineContext & { latencies: number[] } {
  const box = { latencies: [] as number[] };
  const context: EngineContext = {
    now: 0,
    queue: new EventQueue(),
    rng: createRng(1),
    complete: (_at: number, lat: number, ok: boolean) => {
      if (ok) box.latencies.push(lat);
    },
  };
  return Object.assign(context, box);
}

function request(
  handler: (event: never, ctx: EngineContext) => void,
  ctx: EngineContext,
  at: number,
  seq: number,
  kind: string,
  key: number,
): void {
  ctx.now = at;
  handler({ at, seq, kind, targetId: "db", payload: { key } } as never, ctx);
}

describe("database", () => {
  it("sync writes pay lag and never go stale", () => {
    const db = createDatabase("db", { serviceMs: 20, lagMs: 2000, keySpace: 10, mode: "sync" });
    const ctx = testContext();
    request(db.handler, ctx, 0, 0, "write", 3);
    request(db.handler, ctx, 10, 1, "request", 3);
    expect(db.metrics()).toEqual({ reads: 1, writes: 1, stale: 0 });
  });

  it("async serves stale reads inside the lag window", () => {
    const db = createDatabase("db", { serviceMs: 20, lagMs: 2000, keySpace: 10, mode: "async" });
    const ctx = testContext();
    request(db.handler, ctx, 0, 0, "write", 3);
    request(db.handler, ctx, 10, 1, "request", 3);
    const mid = db.metrics();
    expect(mid.writes).toBe(1);
    expect(mid.stale).toBe(1);
    const apply = ctx.queue.pop();
    if (!apply) throw new Error("expected an apply event");
    ctx.now = apply.at;
    db.handler(apply as never, ctx);
    request(db.handler, ctx, 3000, 2, "request", 3);
    expect(db.metrics().stale).toBe(1);
  });

  it("is deterministic for identical sequences", () => {
    const runOnce = (): { reads: number; writes: number; stale: number } => {
      const db = createDatabase("db", { serviceMs: 20, lagMs: 500, keySpace: 5, mode: "async" });
      const ctx = testContext();
      [
        [0, "write", 1],
        [10, "request", 1],
        [20, "write", 2],
        [600, "request", 1],
      ].forEach(([at, kind, key], i) => request(db.handler, ctx, at as number, i, kind as string, key as number));
      return db.metrics();
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
