# M0 Engine Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic sim-core + client/LB/service + load-balancing lab that visibly shows RR overload on a heterogeneous fleet.

**Architecture:** Discrete-event priority queue with virtual clock and seeded xorshift128+. Topology compiles to validated SimGraph, then runs against TrafficProfile + Scenario to produce EventLog, bucketed metrics, and Verdicts.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zero runtime deps in sim-core, Node 26.

**Spec:** `docs/superpowers/specs/2026-09-19-m0-design.md`

## Global Constraints

- TypeScript `strict: true`. No `any`. No `as` casts to silence the compiler.
- `packages/sim-core` has zero dependencies (no lodash, no date-fns) and stays worker-safe: no DOM, no `window`, no `document`, no `Math.random`, no `Date.now`, no `performance.now`.
- Virtual time only. Playback speed is a rendering concern, handled elsewhere.
- Same seed + topology + traffic ⇒ byte-identical event log.
- Naming: `PascalCase` components, `camelCase` functions, `SCREAMING_SNAKE` constants, `kebab-case` files and content slugs.
- Small commits, one task per commit group. Never weaken a test to pass.

---

## File Map

- `package.json` — root workspaces + scripts (test, typecheck, demo)
- `pnpm-workspace.yaml` — workspace globs
- `tsconfig.json` — strict base; `tsconfig.build.json` if needed
- `vitest.config.ts` — workspace test include
- `packages/sim-core/package.json` — name `@backpressure/sim-core`, no deps
- `packages/sim-core/src/types.ts` — Topology, SimGraph, TrafficProfile, Scenario, EventLog, MetricSeries, Verdict, SimContext, Rng interface
- `packages/sim-core/src/rng.ts` — xorshift128+ seeded RNG
- `packages/sim-core/src/queue.ts` — binary-heap EventQueue with seq tiebreak
- `packages/sim-core/src/engine.ts` — compile() + run()
- `packages/sim-core/src/index.ts` — public exports
- `packages/sim-core/tests/rng.test.ts`, `queue.test.ts`, `engine.test.ts`, `determinism.test.ts`
- `packages/sim-components/package.json` — dep on `@backpressure/sim-core` only (workspace:*)
- `packages/sim-components/src/client.ts`, `service.ts`, `load-balancer.ts`, `index.ts`
- `packages/sim-components/tests/components.test.ts`, `load-balancing.test.ts`
- `content/concepts/load-balancing/lab.ts` — preset topology + controls + challenges
- `demo/run.ts` — Node script running RR vs least-conn side-by-side, tabular output
- `demo/package.json` or root script — `tsx` via npx (dev dep only, not in sim-core)

---

### Task 1: Workspace scaffold + strict toolchain

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/sim-core/package.json`, `packages/sim-components/package.json`

**Interfaces:**
- Consumes: nothing (greenfield)
- Produces: workspace scripts `test`, `typecheck`, `demo`; TS strict for all later tasks

- [ ] **Step 1: Write root package.json**

```json
{
  "name": "backpressure",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "demo": "npx -y tsx demo/run.ts"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "vitest": "2.1.8",
    "tsx": "4.19.2"
  }
}
```

- [ ] **Step 2: Write pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "demo"
```

- [ ] **Step 3: Write strict tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["packages/*/src/**/*.ts", "packages/*/tests/**/*.ts", "content/**/*.ts", "demo/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Write vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Write packages/sim-core/package.json (zero deps)**

```json
{
  "name": "@backpressure/sim-core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

- [ ] **Step 6: Write packages/sim-components/package.json**

```json
{
  "name": "@backpressure/sim-components",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@backpressure/sim-core": "workspace:*" }
}
```

- [ ] **Step 7: Install and typecheck (expect no files yet, must pass vacuously)**

Run: `pnpm install && pnpm typecheck`
Expected: PASS (no sources, no errors)

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.json vitest.config.ts packages/sim-core/package.json packages/sim-components/package.json
git commit -m "chore: M0 workspace scaffold with strict TS + vitest"
```

---

### Task 2: sim-core deterministic primitives (types + Rng + queue)

**Files:**
- Create: `packages/sim-core/src/types.ts`
- Create: `packages/sim-core/src/rng.ts`
- Create: `packages/sim-core/src/queue.ts`
- Create: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/tests/rng.test.ts`, `packages/sim-core/tests/queue.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `createRng(seed: number): Rng` with `next(): number` in [0,1), `nextInt(bound: number): number`, `nextExponential(meanMs: number): number`
  - `EventQueue` with `push(at: number, kind: string, targetId: string, payload?: unknown): void`, `pop(): SimEvent | undefined`, `isEmpty(): boolean`, `size(): number`
  - Types: `Topology`, `SimGraph`, `TrafficProfile`, `FaultKind`, `ScenarioEvent`, `Verdict`, `MetricPoint`

- [ ] **Step 1: Write failing RNG test**

```ts
// packages/sim-core/tests/rng.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng.js";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.nextInt(100)];
    const seqB = [b.next(), b.next(), b.nextInt(100)];
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("nextInt stays in range", () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i += 1) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/sim-core/tests/rng.test.ts`
Expected: FAIL with "Failed to resolve import" / "createRng not defined"

- [ ] **Step 3: Write minimal types.ts**

```ts
// packages/sim-core/src/types.ts
export interface TopologyNode {
  id: string;
  kind: string;
  config: Record<string, unknown>;
}

export interface TopologyEdge {
  from: string;
  to: string;
}

export interface Topology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface SimGraph {
  nodes: Map<string, TopologyNode>;
  downstream: Map<string, string[]>;
  order: string[];
}

export interface TrafficProfile {
  rps: number;
  durationMs: number;
  keyAlpha?: number;
}

export type FaultKind = "kill-node" | "traffic-spike";

export interface ScenarioEvent {
  at: number;
  fault: FaultKind;
  targets?: string[];
  rps?: number;
}

export interface SimEvent {
  at: number;
  seq: number;
  kind: string;
  targetId: string;
  payload?: unknown;
}

export interface MetricPoint {
  t: number;
  p50: number;
  p99: number;
  throughput: number;
  errors: number;
  trace: string;
}

export interface Verdict {
  id: string;
  passed: boolean;
  observed: number;
  threshold: number;
  explanation: string;
}

export interface Rng {
  next(): number;
  nextInt(bound: number): number;
  nextExponential(meanMs: number): number;
}
```

- [ ] **Step 4: Write minimal rng.ts (xorshift128+, no Math.random)**

```ts
// packages/sim-core/src/rng.ts
import type { Rng } from "./types.js";

function splitmix32(seed: number): number {
  let z = (seed + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

export function createRng(seed: number): Rng {
  let s0 = splitmix32(seed) || 1;
  let s1 = splitmix32(seed ^ 0x9e3779b9) || 2;

  function nextUint32(): number {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26);
    s1 = x >>> 0;
    return (s1 + y) >>> 0;
  }

  function next(): number {
    return nextUint32() / 4294967296;
  }

  function nextInt(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new Error(`nextInt requires positive integer bound, got ${bound}`);
    }
    return Math.floor(next() * bound);
  }

  function nextExponential(meanMs: number): number {
    if (!(meanMs > 0)) {
      throw new Error(`nextExponential requires meanMs > 0, got ${meanMs}`);
    }
    const u = Math.min(1 - 1e-12, Math.max(1e-12, next()));
    return -Math.log(1 - u) * meanMs;
  }

  return { next, nextInt, nextExponential };
}
```

- [ ] **Step 5: Write failing queue test**

```ts
// packages/sim-core/tests/queue.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue } from "../src/queue.js";

describe("EventQueue", () => {
  it("pops in time order with seq tiebreak", () => {
    const q = new EventQueue();
    q.push(10, "a", "n1");
    q.push(5, "b", "n2");
    q.push(5, "c", "n3");
    expect(q.pop()?.kind).toBe("b");
    expect(q.pop()?.kind).toBe("c");
    expect(q.pop()?.kind).toBe("a");
    expect(q.isEmpty()).toBe(true);
  });
});
```

- [ ] **Step 6: Write minimal queue.ts (binary heap)**

```ts
// packages/sim-core/src/queue.ts
import type { SimEvent } from "./types.js";

export class EventQueue {
  private heap: SimEvent[] = [];
  private nextSeq = 0;

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(at: number, kind: string, targetId: string, payload?: unknown): void {
    if (!(at >= 0)) {
      throw new Error(`EventQueue.push requires at >= 0, got ${at}`);
    }
    const event: SimEvent = { at, seq: this.nextSeq, kind, targetId, payload };
    this.nextSeq += 1;
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): SimEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    if (top === undefined) return undefined;
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private less(a: SimEvent, b: SimEvent): boolean {
    if (a.at !== b.at) return a.at < b.at;
    return a.seq < b.seq;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      const cur = this.heap[i];
      const par = this.heap[parent];
      if (cur === undefined || par === undefined) break;
      if (!this.less(cur, par)) break;
      this.heap[i] = par;
      this.heap[parent] = cur;
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      const cur = this.heap[smallest];
      const l = this.heap[left];
      const r = this.heap[right];
      if (cur === undefined) break;
      if (l !== undefined && this.less(l, this.heap[smallest] as SimEvent)) smallest = left;
      if (r !== undefined && this.less(r, this.heap[smallest] as SimEvent)) smallest = right;
      if (smallest === i) break;
      const tmp = this.heap[i];
      const swp = this.heap[smallest];
      if (tmp === undefined || swp === undefined) break;
      this.heap[i] = swp;
      this.heap[smallest] = tmp;
      i = smallest;
    }
  }
}
```

- [ ] **Step 7: Write index.ts exports**

```ts
// packages/sim-core/src/index.ts
export type {
  MetricPoint,
  Rng,
  ScenarioEvent,
  SimEvent,
  SimGraph,
  Topology,
  TopologyEdge,
  TopologyNode,
  TrafficProfile,
  Verdict,
} from "./types.js";
export { createRng } from "./rng.js";
export { EventQueue } from "./queue.js";
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm vitest run packages/sim-core/tests/rng.test.ts packages/sim-core/tests/queue.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/sim-core/src packages/sim-core/tests
git commit -m "feat(sim-core): deterministic rng, event queue, base types"
```

---

### Task 3: sim-core engine (compile + run + metrics + verdicts)

**Files:**
- Create: `packages/sim-core/src/engine.ts`
- Modify: `packages/sim-core/src/index.ts` (add engine exports)
- Test: `packages/sim-core/tests/engine.test.ts`, `packages/sim-core/tests/determinism.test.ts`

**Interfaces:**
- Consumes: `Topology`, `TrafficProfile`, `ScenarioEvent`, `EventQueue`, `Rng` from Task 2
- Produces:
  - `compile(topology: Topology): SimGraph` — throws on duplicate ids, unknown edge endpoints, cycles
  - `HandlerFn = (event: SimEvent, ctx: EngineContext) => void`
  - `run(opts: RunOpts): RunResult` where `RunOpts = { seed: number; graph: SimGraph; traffic: TrafficProfile; scenario?: ScenarioEvent[]; handlers: Map<string, HandlerFn>; sloP99Ms?: number }`, `RunResult = { eventLog: SimEvent[]; metrics: MetricPoint[]; verdicts: Verdict[] }`
  - `EngineContext = { now: number; queue: EventQueue; rng: Rng; log: SimEvent[]; complete: (at: number, latencyMs: number, ok: boolean) => void }`

- [ ] **Step 1: Write failing compile test**

```ts
// packages/sim-core/tests/engine.test.ts
import { describe, expect, it } from "vitest";
import { compile } from "../src/engine.js";

describe("compile", () => {
  it("rejects duplicate node ids", () => {
    expect(() =>
      compile({
        nodes: [
          { id: "a", kind: "client", config: {} },
          { id: "a", kind: "service", config: {} },
        ],
        edges: [],
      }),
    ).toThrow(/duplicate/i);
  });

  it("rejects edges to unknown nodes", () => {
    expect(() =>
      compile({
        nodes: [{ id: "a", kind: "client", config: {} }],
        edges: [{ from: "a", to: "missing" }],
      }),
    ).toThrow(/unknown/i);
  });

  it("rejects cycles", () => {
    expect(() =>
      compile({
        nodes: [
          { id: "a", kind: "svc", config: {} },
          { id: "b", kind: "svc", config: {} },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
      }),
    ).toThrow(/cycle/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/sim-core/tests/engine.test.ts`
Expected: FAIL (compile not defined)

- [ ] **Step 3: Write minimal engine.ts**

```ts
// packages/sim-core/src/engine.ts
import { EventQueue } from "./queue.js";
import { createRng } from "./rng.js";
import type {
  MetricPoint,
  ScenarioEvent,
  SimEvent,
  SimGraph,
  Topology,
  TrafficProfile,
  Verdict,
} from "./types.js";

export interface EngineContext {
  now: number;
  queue: EventQueue;
  rng: ReturnType<typeof createRng>;
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
  const nodes = new Map();
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
    if (entry !== undefined) queue.push(at, "request", entry, { id: i });
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
```

- [ ] **Step 4: Update index.ts to export engine**

```ts
// packages/sim-core/src/index.ts
export type {
  MetricPoint,
  Rng,
  ScenarioEvent,
  SimEvent,
  SimGraph,
  Topology,
  TopologyEdge,
  TopologyNode,
  TrafficProfile,
  Verdict,
} from "./types.js";
export { createRng } from "./rng.js";
export { EventQueue } from "./queue.js";
export { compile, run } from "./engine.js";
export type { EngineContext, HandlerFn, RunOpts, RunResult } from "./engine.js";
```

- [ ] **Step 5: Write determinism test**

```ts
// packages/sim-core/tests/determinism.test.ts
import { describe, expect, it } from "vitest";
import { compile, run } from "../src/index.js";

function hashEvents(events: unknown[]): string {
  return JSON.stringify(events);
}

describe("determinism", () => {
  it("same seed gives byte-identical log", () => {
    const graph = compile({
      nodes: [{ id: "a", kind: "echo", config: {} }],
      edges: [],
    });
    const handlers = new Map([
      ["a", (e, ctx) => {
        ctx.complete(e.at + 5, 5, true);
      }],
    ]);
    const r1 = run({ seed: 99, graph, traffic: { rps: 50, durationMs: 2000 }, handlers });
    const r2 = run({ seed: 99, graph, traffic: { rps: 50, durationMs: 2000 }, handlers });
    expect(hashEvents(r2.eventLog)).toBe(hashEvents(r1.eventLog));
    expect(r2.metrics).toEqual(r1.metrics);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run packages/sim-core`
Expected: PASS

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/sim-core/src packages/sim-core/tests
git commit -m "feat(sim-core): compile, discrete-event run, metrics, verdicts"
```

---

### Task 4: sim-components (client sink, service queue, LB strategies)

**Files:**
- Create: `packages/sim-components/src/service.ts`
- Create: `packages/sim-components/src/load-balancer.ts`
- Create: `packages/sim-components/src/client.ts`
- Create: `packages/sim-components/src/index.ts`
- Test: `packages/sim-components/tests/components.test.ts`, `packages/sim-components/tests/load-balancing.test.ts`

**Interfaces:**
- Consumes: `EngineContext`, `SimEvent` from sim-core
- Produces:
  - `createService(id: string, opts: { serviceMs: number; concurrency: number; queueLimit: number; downstream?: string }): { handler: HandlerFn; metrics(): { queueDepth: number; inflight: number }; narrate(): string }`
  - `createLoadBalancer(opts: { strategy: "round-robin"|"least-connections"; backends: string[]; getInflight: (id: string) => number }): { pick(): string; narrate(): string }`
  - Service completion calls `ctx.complete(endAt, latencyMs, true)`; overflow calls `ctx.complete(now, 0, false)`

- [ ] **Step 1: Write failing service test**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/sim-components/tests/components.test.ts`
Expected: FAIL (service.ts missing)

- [ ] **Step 3: Write minimal service.ts**

```ts
// packages/sim-components/src/service.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface ServiceOpts {
  serviceMs: number;
  concurrency: number;
  queueLimit: number;
}

export function createService(id: string, opts: ServiceOpts): {
  handler: HandlerFn;
  metrics: () => { queueDepth: number; inflight: number };
  narrate: () => string;
} {
  let inflight = 0;
  const waiting: { arrival: number }[] = [];
  let served = 0;
  let dropped = 0;

  function startOne(ctx: EngineContext, arrival: number): void {
    inflight += 1;
    const endAt = ctx.now + opts.serviceMs;
    ctx.queue.push(endAt, `complete:${id}`, id, { arrival });
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind === "request") {
      if (inflight < opts.concurrency) {
        startOne(ctx, event.at);
      } else if (waiting.length < opts.queueLimit) {
        waiting.push({ arrival: event.at });
      } else {
        dropped += 1;
        ctx.complete(ctx.now, 0, false);
      }
      return;
    }
    if (event.kind === `complete:${id}`) {
      inflight = Math.max(0, inflight - 1);
      served += 1;
      const payload = event.payload as { arrival: number } | undefined;
      ctx.complete(event.at, event.at - (payload?.arrival ?? event.at), true);
      const next = waiting.shift();
      if (next) startOne(ctx, next.arrival);
      return;
    }
  }

  function metrics(): { queueDepth: number; inflight: number } {
    return { queueDepth: waiting.length, inflight };
  }

  function narrate(): string {
    return `${id}: served=${served} dropped=${dropped} inflight=${inflight} queued=${waiting.length}`;
  }

  return { handler, metrics, narrate };
}
```

- [ ] **Step 4: Write minimal load-balancer.ts**

```ts
// packages/sim-components/src/load-balancer.ts
export type LbStrategy = "round-robin" | "least-connections";

export function createLoadBalancer(opts: {
  strategy: LbStrategy;
  backends: string[];
}): { pick: (getInflight: (id: string) => number) => string; narrate: () => string } {
  if (opts.backends.length === 0) throw new Error("load balancer needs at least one backend");
  let cursor = 0;
  let picks = 0;

  function pick(getInflight: (id: string) => number): string {
    picks += 1;
    const first = opts.backends[0];
    if (first === undefined) throw new Error("no backends");
    if (opts.strategy === "round-robin") {
      const chosen = opts.backends[cursor % opts.backends.length];
      cursor += 1;
      return chosen ?? first;
    }
    let best = first;
    let bestLoad = getInflight(first);
    for (const b of opts.backends) {
      const load = getInflight(b);
      if (load < bestLoad) {
        best = b;
        bestLoad = load;
      }
    }
    return best;
  }

  function narrate(): string {
    return `lb(${opts.strategy}): picks=${picks} backends=[${opts.backends.join(",")}]`;
  }

  return { pick, narrate };
}
```

- [ ] **Step 5: Write minimal client.ts + index.ts**

```ts
// packages/sim-components/src/client.ts
export function describeClient(rps: number, durationMs: number): string {
  return `client: ${rps} rps for ${durationMs}ms`;
}
```

```ts
// packages/sim-components/src/index.ts
export { createService } from "./service.js";
export type { ServiceOpts } from "./service.js";
export { createLoadBalancer } from "./load-balancer.js";
export type { LbStrategy } from "./load-balancer.js";
export { describeClient } from "./client.js";
```

- [ ] **Step 6: Write load-balancing divergence test (the M0 proof)**

```ts
// packages/sim-components/tests/load-balancing.test.ts
import { describe, expect, it } from "vitest";
import { compile, run } from "@backpressure/sim-core";
import { createLoadBalancer } from "../src/load-balancer.js";
import { createService } from "../src/service.js";

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
  const inflight = new Map([["fast", 0], ["slow", 0]]);
  const handlers = new Map([
    ["lb", (e, ctx) => {
      const target = lb.pick((id) => inflight.get(id) ?? 0);
      inflight.set(target, (inflight.get(target) ?? 0) + 1);
      ctx.queue.push(e.at, "request", target, { arrival: e.at, via: target });
    }],
    ["fast", (e, ctx) => {
      if (e.kind === "request") inflight.set("fast", (inflight.get("fast") ?? 1) - 0);
      fast.handler(e, ctx);
    }],
    ["slow", (e, ctx) => {
      slow.handler(e, ctx);
    }],
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
```

- [ ] **Step 7: Run tests (expect divergence test may need tuning, do not weaken — fix model)**

Run: `pnpm vitest run packages/sim-components`
Expected: PASS (if RR-vs-LC fails, fix inflight tracking/service times, never assert weaker)

- [ ] **Step 8: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS

```bash
git add packages/sim-components/src packages/sim-components/tests
git commit -m "feat(sim-components): service queue, LB strategies, RR-overload proof"
```

---

### Task 5: load-balancing lab preset + demo script

**Files:**
- Create: `content/concepts/load-balancing/lab.ts`
- Create: `demo/run.ts`
- Create: `demo/package.json`

**Interfaces:**
- Consumes: `compile`, `run` from sim-core; `createService`, `createLoadBalancer` from sim-components
- Produces: `labPreset` with topology/controls/metrics/challenges; demo prints side-by-side table + narration + verdicts

- [ ] **Step 1: Write lab.ts preset**

```ts
// content/concepts/load-balancing/lab.ts
export const LAB_ID = "load-balancing";

export interface LabControl {
  id: string;
  label: string;
  kind: "select" | "slider";
  options?: string[];
  min?: number;
  max?: number;
  def: string | number;
}

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: { strategy: "round-robin" } },
      { id: "fast", kind: "service", config: { serviceMs: 20, concurrency: 2, queueLimit: 50 } },
      { id: "slow", kind: "service", config: { serviceMs: 80, concurrency: 2, queueLimit: 50 } },
    ],
    edges: [
      { from: "lb", to: "fast" },
      { from: "lb", to: "slow" },
    ],
  },
  controls: [
    { id: "strategy", label: "LB strategy", kind: "select", options: ["round-robin", "least-connections"], def: "round-robin" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 10, max: 300, def: 100 },
  ] as LabControl[],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "lb.1", text: "Keep p99 under 150ms at 100 RPS by switching strategy", verdict: "slo.p99" },
    { id: "lb.2", text: "Survive one backend kill with p99 degradation < 2x", verdict: "slo.p99" },
  ],
};
```

- [ ] **Step 2: Write demo/run.ts (side-by-side, tabular, no color-only)**

```ts
// demo/run.ts
import { compile, run } from "@backpressure/sim-core";
import { createLoadBalancer, createService } from "@backpressure/sim-components";
import type { LbStrategy } from "@backpressure/sim-components";

function runOnce(strategy: LbStrategy, rps: number): { p99: number; narration: string[] } {
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
  const handlers = new Map([
    ["lb", (e, ctx) => {
      const loads = new Map([["fast", fast.metrics().inflight], ["slow", slow.metrics().inflight]]);
      const target = lb.pick((id) => loads.get(id) ?? 0);
      ctx.queue.push(e.at, "request", target, { arrival: e.at });
    }],
    ["fast", fast.handler],
    ["slow", slow.handler],
  ]);
  const result = run({ seed: 7, graph, traffic: { rps, durationMs: 5000 }, handlers, sloP99Ms: 150 });
  const p99 = result.verdicts.find((v) => v.id === "slo.p99")?.observed ?? 0;
  return { p99, narration: [lb.narrate(), fast.narrate(), slow.narrate()] };
}

const strategies: LbStrategy[] = ["round-robin", "least-connections"];
console.log("strategy\tp99(ms)\tnarration");
for (const s of strategies) {
  const r = runOnce(s, 100);
  console.log(`${s}\t${r.p99}\t${r.narration.join(" | ")}`);
}
```

- [ ] **Step 3: Write demo/package.json**

```json
{
  "name": "demo",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 4: Run demo to verify divergence is visible**

Run: `pnpm demo`
Expected: PASS with `round-robin` p99 visibly higher than `least-connections`; both rows print narration text

- [ ] **Step 5: Run full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (all determinism + component tests green)

- [ ] **Step 6: Worker-safety grep (no Math.random/Date/window in sim-core)**

Run: `rg -n "Math\\.random|Date\\.now|performance\\.now|window|document" packages/sim-core/src || echo "clean"`
Expected: `clean`

- [ ] **Step 7: Commit**

```bash
git add content/concepts/load-balancing/lab.ts demo/run.ts demo/package.json
git commit -m "feat(lab): load-balancing preset + side-by-side demo"
```

---

## Self-Review

- Spec §Goal (RR overload visible, determinism, narration) → Task 4 Step 6 + Task 5 Step 4.
- Spec compile/run/metrics/verdicts → Task 3.
- Spec Rng/queue determinism → Task 2 + determinism test.
- No placeholders: every step has exact file paths, code, commands, expected output.
- Type consistency: `HandlerFn`, `EngineContext`, `RunOpts` names match across Tasks 3–5; `createService`/`createLoadBalancer` signatures identical in Tasks 4–5.
- Skipped per ponytail: Turborepo, Next.js, Zod, worker wiring, cost model — add when M1 needs them.
