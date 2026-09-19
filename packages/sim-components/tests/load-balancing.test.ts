// packages/sim-components/tests/load-balancing.test.ts
import { describe, expect, it } from "vitest";
import { compile, run } from "@backpressure/sim-core";
import type { HandlerFn } from "@backpressure/sim-core";
import { createLoadBalancer } from "../src/load-balancer.js";
import { createService } from "../src/service.js";

function loadOf(id: string, fast: { metrics: () => { queueDepth: number; inflight: number } }, slow: { metrics: () => { queueDepth: number; inflight: number } }): number {
  const m = id === "fast" ? fast.metrics() : slow.metrics();
  return m.inflight + m.queueDepth;
}

function runStrategy(strategy: "round-robin" | "least-connections"): number {
  const graph = compile({
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      { id: "fast", kind: "service", config: {} },
      { id: "slow", kind: "service", config: {} },
    ],
    edges: [
      { from: "lb", to: "fast" },
      { from: "lb", to: "slow" },
    ],
  });
  const fast = createService("fast", { serviceMs: 20, concurrency: 2, queueLimit: 50 });
  const slow = createService("slow", { serviceMs: 80, concurrency: 2, queueLimit: 50 });
  const lb = createLoadBalancer({ strategy, backends: ["fast", "slow"] });
  const handlers = new Map<string, HandlerFn>([
    ["lb", (e, ctx) => {
      if (e.kind !== "request") return;
      const target = lb.pick((id) => loadOf(id, fast, slow));
      ctx.queue.push(e.at, "request", target, { arrival: e.at });
    }],
    ["fast", fast.handler],
    ["slow", slow.handler],
  ]);
  const result = run({ seed: 7, graph, traffic: { rps: 100, durationMs: 5000 }, handlers, sloP99Ms: 150 });
  const p99 = result.verdicts.find((v) => v.id === "slo.p99");
  return p99?.observed ?? 0;
}

describe("heterogeneous fleet", () => {
  it("round-robin has worse p99 than least-connections", () => {
    const rr = runStrategy("round-robin");
    const lc = runStrategy("least-connections");
    expect(rr).toBeGreaterThan(lc);
  });
});
