// packages/sim-components/tests/queue-fanout.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue, createRng } from "@backpressure/sim-core";
import type { EngineContext } from "@backpressure/sim-core";
import { createQueue } from "../src/queue.js";
import { createFanout } from "../src/fan-out.js";

function testContext(): EngineContext {
  return { now: 0, queue: new EventQueue(), rng: createRng(1), complete: () => {} };
}

function fire(
  handler: (event: never, ctx: EngineContext) => void,
  ctx: EngineContext,
  at: number,
  seq: number,
  id: number,
): void {
  ctx.now = at;
  handler({ at, seq, kind: "request", targetId: "q", payload: { id } } as never, ctx);
}

describe("queue", () => {
  it("buffers to maxDepth then drops", () => {
    const queue = createQueue("q", { drainRps: 10, maxDepth: 5, poisonEvery: 0 }, "svc");
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(queue.handler, ctx, 0, i, i);
    // Cold tokens start at 0, so the instant burst of 10 fills 5 and drops 5.
    expect(queue.metrics()).toEqual({ depth: 5, enqueued: 5, rejected: 5, deadLettered: 0 });
  });

  it("dead-letters poison ids", () => {
    const queue = createQueue("q", { drainRps: 100, maxDepth: 50, poisonEvery: 5 }, "svc");
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) fire(queue.handler, ctx, i * 100, i, i);
    expect(queue.metrics().deadLettered).toBe(2);
  });

  it("is deterministic for identical sequences", () => {
    const runOnce = (): string => {
      const queue = createQueue("q", { drainRps: 20, maxDepth: 10, poisonEvery: 7 }, "svc");
      const ctx = testContext();
      [0, 0, 30, 100, 100, 900].forEach((at, i) => fire(queue.handler, ctx, at, i, i));
      const m = queue.metrics();
      return `${m.depth},${m.enqueued},${m.rejected},${m.deadLettered}`;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe("fan-out", () => {
  it("broadcasts to every target", () => {
    const fanout = createFanout("fan", ["a", "b", "c"]);
    const ctx = testContext();
    ctx.now = 0;
    fanout.handler({ at: 0, seq: 0, kind: "write", targetId: "fan", payload: { id: 1 } } as never, ctx);
    const targets: string[] = [];
    let e = ctx.queue.pop();
    while (e !== undefined) {
      targets.push(e.targetId);
      e = ctx.queue.pop();
    }
    expect(targets).toEqual(["a", "b", "c"]);
    expect(fanout.metrics()).toEqual({ fanned: 1 });
  });

  it("throws on empty targets", () => {
    expect(() => createFanout("fan", [])).toThrow(/target/i);
  });
});

describe("fan-out writeOnly", () => {
  it("fans writes, singles reads", () => {
    const fanout = createFanout("fan", ["a", "b"], { writeOnly: true });
    const ctx = testContext();
    ctx.now = 0;
    fanout.handler({ at: 0, seq: 0, kind: "request", targetId: "fan", payload: { id: 1 } } as never, ctx);
    fanout.handler({ at: 1, seq: 1, kind: "write", targetId: "fan", payload: { id: 2 } } as never, ctx);
    const targets: string[] = [];
    let e = ctx.queue.pop();
    while (e !== undefined) {
      targets.push(e.targetId);
      e = ctx.queue.pop();
    }
    expect(targets).toEqual(["a", "a", "b"]);
  });
});
