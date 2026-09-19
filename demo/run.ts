// demo/run.ts
import { compile, run } from "@backpressure/sim-core";
import type { HandlerFn } from "@backpressure/sim-core";
import { createLoadBalancer, createService } from "@backpressure/sim-components";
import type { LbStrategy } from "@backpressure/sim-components";

const SEED = 7;
const DURATION_MS = 5000;
const SLO_P99_MS = 150;
// 80 RPS default: least-connections passes the 150ms SLO (p99 ~146ms)
// while round-robin overloads the slow backend (p99 ~2s). At 100 RPS even
// least-connections misses SLO (p99 ~178ms), so 100 is left as an exercise.
const DEFAULT_RPS = 80;

interface StrategyResult {
  strategy: LbStrategy;
  p99: number;
  sloPass: boolean;
  narration: string[];
}

function runOnce(strategy: LbStrategy, rps: number): StrategyResult {
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
      const target = lb.pick((id) => {
        const m = id === "fast" ? fast.metrics() : slow.metrics();
        return m.inflight + m.queueDepth;
      });
      ctx.queue.push(e.at, "request", target, { arrival: e.at });
    }],
    ["fast", fast.handler],
    ["slow", slow.handler],
  ]);
  const result = run({ seed: SEED, graph, traffic: { rps, durationMs: DURATION_MS }, handlers, sloP99Ms: SLO_P99_MS });
  const verdict = result.verdicts.find((v) => v.id === "slo.p99");
  return {
    strategy,
    p99: verdict?.observed ?? 0,
    sloPass: verdict?.passed ?? false,
    narration: [lb.narrate(), fast.narrate(), slow.narrate()],
  };
}

const rawRps = Number(process.argv[2] ?? String(DEFAULT_RPS));
if (!Number.isFinite(rawRps) || rawRps <= 0) {
  throw new Error(`demo usage: pnpm demo [rps]; got ${process.argv[2] ?? ""}`);
}
const rps: number = rawRps;

const strategies: LbStrategy[] = ["round-robin", "least-connections"];
console.log(`rps=${rps} seed=${SEED} durationMs=${DURATION_MS} sloP99Ms=${SLO_P99_MS}`);
console.log("strategy\tp99(ms)\tslo.p99\tnarration");
for (const s of strategies) {
  const r = runOnce(s, rps);
  console.log(`${r.strategy}\t${r.p99}\t${r.sloPass ? "PASS" : "FAIL"}\t${r.narration.join(" | ")}`);
}
