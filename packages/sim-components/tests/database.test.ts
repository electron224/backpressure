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

describe("partition window", () => {
  const partitioned = { partitionAt: 2000, partitionFor: 2000 } as const;

  it("sync fails reads and writes inside the window, zero stale", () => {
    const db = createDatabase("db", { serviceMs: 20, lagMs: 200, keySpace: 10, mode: "sync", ...partitioned });
    const ctx = testContext();
    const failed: boolean[] = [];
    const inner = ctx.complete.bind(ctx);
    ctx.complete = (at: number, lat: number, ok: boolean): void => {
      failed.push(ok);
      inner(at, lat, ok);
    };
    request(db.handler, ctx, 0, 0, "write", 1);
    request(db.handler, ctx, 2500, 1, "request", 1);
    request(db.handler, ctx, 2500, 2, "write", 1);
    request(db.handler, ctx, 4500, 3, "request", 1);
    expect(failed).toEqual([true, false, false, true]);
    expect(db.metrics().stale).toBe(0);
  });

  it("async serves stale inside the window and heals after", () => {
    const db = createDatabase("db", { serviceMs: 20, lagMs: 200, keySpace: 10, mode: "async", ...partitioned });
    const ctx = testContext();
    request(db.handler, ctx, 0, 0, "write", 1);
    request(db.handler, ctx, 500, 1, "request", 1);
    request(db.handler, ctx, 2500, 2, "write", 1);
    request(db.handler, ctx, 2600, 3, "request", 1);
    const mid = db.metrics();
    expect(mid.stale).toBeGreaterThan(0);
    // Drain apply + heal, then read fresh.
    for (let i = 0; i < 20; i += 1) {
      const e = ctx.queue.pop();
      if (!e) break;
      ctx.now = e.at;
      db.handler(e as never, ctx);
    }
    request(db.handler, ctx, 6000, 4, "request", 1);
    expect(db.metrics().stale).toBe(mid.stale);
  });
});

describe("quorum replicas", () => {
  const lags = [100, 500, 2000];

  it("write latency follows the concern quorum", () => {
    const lats: Record<string, number[]> = { one: [], majority: [], all: [] };
    for (const concern of ["one", "majority", "all"] as const) {
      const db = createDatabase("db", { serviceMs: 20, lagMs: 500, keySpace: 10, mode: "sync", replicas: lags, writeConcern: concern });
      const ctx = testContext();
      const inner = ctx.complete.bind(ctx);
      ctx.complete = (at: number, lat: number, ok: boolean): void => {
        if (ok) lats[concern]?.push(lat);
        inner(at, lat, ok);
      };
      request(db.handler, ctx, 0, 0, "write", 1);
    }
    expect(lats["one"]).toEqual([120]);
    expect(lats["majority"]).toEqual([520]);
    expect(lats["all"]).toEqual([2020]);
  });

  it("reads spread across replicas and go stale", () => {
    const db = createDatabase("db", { serviceMs: 20, lagMs: 2000, keySpace: 10, mode: "async", replicas: lags });
    const ctx = testContext();
    request(db.handler, ctx, 0, 0, "write", 1);
    request(db.handler, ctx, 100, 1, "request", 1);
    request(db.handler, ctx, 200, 2, "request", 1);
    const m = db.metrics();
    expect(m.reads).toBe(2);
    expect(m.stale).toBeGreaterThanOrEqual(1);
  });
});
