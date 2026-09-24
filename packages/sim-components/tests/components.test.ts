// packages/sim-components/tests/components.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue } from "@backpressure/sim-core";
import { createRng } from "@backpressure/sim-core";
import { createService } from "../src/service.js";

describe("service", () => {
  it("returns 503 when queue overflows", () => {
    const svc = createService("s1", { serviceMs: 100, concurrency: 1, queueLimit: 1 });
    const completions: { ok: boolean }[] = [];
    const queue = new EventQueue();
    const ctx = { now: 0, queue, rng: createRng(1), complete: (_at: number, _lat: number, ok: boolean) => { completions.push({ ok }); } };
    svc.handler({ at: 0, seq: 0, kind: "request", targetId: "s1" }, ctx);
    ctx.now = 1;
    svc.handler({ at: 1, seq: 1, kind: "request", targetId: "s1" }, ctx);
    ctx.now = 2;
    svc.handler({ at: 2, seq: 2, kind: "request", targetId: "s1" }, ctx);
    for (let i = 0; i < 10; i += 1) {
      const e = queue.pop();
      if (!e) break;
      ctx.now = e.at;
      svc.handler(e, ctx);
    }
    expect(completions.some((c) => !c.ok)).toBe(true);
  });
});

describe("service writes", () => {
  it("serves writes like requests", () => {
    const svc = createService("s1", { serviceMs: 100, concurrency: 1, queueLimit: 1 });
    const completions: { ok: boolean }[] = [];
    const queue = new EventQueue();
    const ctx = { now: 0, queue, rng: createRng(1), complete: (_at: number, _lat: number, ok: boolean) => { completions.push({ ok }); } };
    svc.handler({ at: 0, seq: 0, kind: "write", targetId: "s1" }, ctx);
    for (let i = 0; i < 10; i += 1) {
      const e = queue.pop();
      if (!e) break;
      ctx.now = e.at;
      svc.handler(e, ctx);
    }
    expect(completions).toEqual([{ ok: true }]);
  });
});

describe("service read/write split", () => {
  it("charges writes writeMs and reads readMs", () => {
    const svc = createService("s1", { serviceMs: 20, concurrency: 4, queueLimit: 10, readMs: 10, writeMs: 100 });
    const latencies: number[] = [];
    const queue = new EventQueue();
    const ctx = { now: 0, queue, rng: createRng(1), complete: (_at: number, lat: number, ok: boolean) => { if (ok) latencies.push(lat); } };
    svc.handler({ at: 0, seq: 0, kind: "request", targetId: "s1" }, ctx);
    svc.handler({ at: 0, seq: 1, kind: "write", targetId: "s1" }, ctx);
    for (let i = 0; i < 10; i += 1) {
      const e = queue.pop();
      if (!e) break;
      ctx.now = e.at;
      svc.handler(e, ctx);
    }
    expect(latencies).toEqual([10, 100]);
  });

  it("defaults both to serviceMs", () => {
    const svc = createService("s1", { serviceMs: 20, concurrency: 4, queueLimit: 10 });
    const latencies: number[] = [];
    const queue = new EventQueue();
    const ctx = { now: 0, queue, rng: createRng(1), complete: (_at: number, lat: number, ok: boolean) => { if (ok) latencies.push(lat); } };
    svc.handler({ at: 0, seq: 0, kind: "write", targetId: "s1" }, ctx);
    for (let i = 0; i < 10; i += 1) {
      const e = queue.pop();
      if (!e) break;
      ctx.now = e.at;
      svc.handler(e, ctx);
    }
    expect(latencies).toEqual([20]);
  });
});
