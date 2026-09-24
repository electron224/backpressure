// packages/sim-core/src/engine.ts
import { EventQueue } from "./queue.js";
import { createRng } from "./rng.js";
import type {
  MetricPoint,
  Rng,
  ScenarioEvent,
  SimEvent,
  SimGraph,
  Topology,
  TopologyNode,
  TrafficProfile,
  Verdict,
} from "./types.js";

export interface EngineContext {
  now: number;
  queue: EventQueue;
  rng: Rng;
  complete: (at: number, latencyMs: number, ok: boolean) => void;
}

export type HandlerFn = (event: SimEvent, ctx: EngineContext) => void;

export interface RunOpts {
  seed: number;
  graph: SimGraph;
  traffic: TrafficProfile;
  scenario?: ScenarioEvent[];
  handlers: Map<string, HandlerFn>;
  sloP99Ms?: number;
}

export interface RunResult {
  eventLog: SimEvent[];
  metrics: MetricPoint[];
  verdicts: Verdict[];
}

export function compile(topology: Topology): SimGraph {
  const nodes = new Map<string, TopologyNode>();
  for (const n of topology.nodes) {
    if (nodes.has(n.id)) throw new Error(`duplicate node id: ${n.id}`);
    nodes.set(n.id, n);
  }
  const downstream = new Map<string, string[]>();
  for (const n of topology.nodes) downstream.set(n.id, []);
  for (const e of topology.edges) {
    if (!nodes.has(e.from)) throw new Error(`unknown edge source: ${e.from}`);
    if (!nodes.has(e.to)) throw new Error(`unknown edge target: ${e.to}`);
    const list = downstream.get(e.from);
    if (list) list.push(e.to);
  }
  const order: string[] = [];
  const mark = new Map<string, number>();
  const visit = (id: string, stack: string[]): void => {
    const state = mark.get(id) ?? 0;
    if (state === 1) throw new Error(`cycle detected: ${[...stack, id].join(" -> ")}`);
    if (state === 2) return;
    mark.set(id, 1);
    for (const next of downstream.get(id) ?? []) visit(next, [...stack, id]);
    mark.set(id, 2);
    order.push(id);
  };
  for (const n of topology.nodes) visit(n.id, []);
  return { nodes, downstream, order };
}

interface Completion {
  at: number;
  latencyMs: number;
  ok: boolean;
}

export function run(opts: RunOpts): RunResult {
  const rng = createRng(opts.seed);
  const queue = new EventQueue();
  const eventLog: SimEvent[] = [];
  const completions: Completion[] = [];

  const ctx: EngineContext = {
    now: 0,
    queue,
    rng,
    complete: (at, latencyMs, ok) => {
      completions.push({ at, latencyMs, ok });
    },
  };

  for (const s of opts.scenario ?? []) {
    queue.push(s.at, `fault:${s.fault}`, s.targets?.[0] ?? "__all__", s);
  }

  const arrivals = Math.max(0, Math.floor((opts.traffic.rps * opts.traffic.durationMs) / 1000));
  const meanGap = opts.traffic.rps > 0 ? 1000 / opts.traffic.rps : opts.traffic.durationMs;
  let at = 0;
  const roots = opts.graph.order.filter((id) => {
    for (const list of opts.graph.downstream.values()) {
      if (list.includes(id)) return false;
    }
    return true;
  });
  const entry = roots[0] ?? opts.graph.order[0];
  for (let i = 0; i < arrivals; i += 1) {
    at += rng.nextExponential(meanGap);
    if (at > opts.traffic.durationMs) break;
    // Short-circuit keeps the RNG stream identical when writes are off,
    // so legacy presets stay byte-identical.
    const ratio = opts.traffic.writeRatio ?? 0;
    const kind = ratio > 0 && rng.next() < ratio ? "write" : "request";
    if (entry !== undefined) queue.push(at, kind, entry, { id: i });
  }

  const endAt = opts.traffic.durationMs;
  while (!queue.isEmpty()) {
    const event = queue.pop();
    if (event === undefined) break;
    if (event.at > endAt + 60_000) break;
    ctx.now = event.at;
    eventLog.push(event);
    const handler = opts.handlers.get(event.targetId) ?? opts.handlers.get(event.kind);
    if (handler) handler(event, ctx);
  }

  const metrics = bucketize(completions, opts.traffic.durationMs);
  const verdicts = judge(completions, opts.sloP99Ms ?? 150);
  return { eventLog, metrics, verdicts };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

function bucketize(completions: Completion[], durationMs: number): MetricPoint[] {
  const out: MetricPoint[] = [];
  for (let start = 0; start < durationMs; start += 1000) {
    const inBucket = completions
      .filter((c) => c.at >= start && c.at < start + 1000 && c.ok)
      .map((c) => c.latencyMs)
      .sort((a, b) => a - b);
    const errors = completions.filter((c) => c.at >= start && c.at < start + 1000 && !c.ok).length;
    const p50 = percentile(inBucket, 50);
    const p99 = percentile(inBucket, 99);
    out.push({
      t: start,
      p50,
      p99,
      throughput: inBucket.length + errors,
      errors,
      trace: `bucket [${start},${start + 1000}): n=${inBucket.length} ok, errors=${errors}, p50=${p50}ms, p99=${p99}ms`,
    });
  }
  return out;
}

function judge(completions: Completion[], sloP99Ms: number): Verdict[] {
  const ok = completions.filter((c) => c.ok).map((c) => c.latencyMs).sort((a, b) => a - b);
  const p99 = percentile(ok, 99);
  return [
    {
      id: "slo.p99",
      passed: ok.length > 0 && p99 <= sloP99Ms,
      observed: p99,
      threshold: sloP99Ms,
      explanation: ok.length === 0 ? "no successful requests" : `p99 ${p99}ms vs SLO ${sloP99Ms}ms over ${ok.length} requests`,
    },
    {
      id: "throughput.sustained",
      passed: completions.length > 0,
      observed: completions.length,
      threshold: 1,
      explanation: `${completions.length} requests completed (ok=${ok.length})`,
    },
  ];
}
