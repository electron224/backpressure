# Rate Limiting Implementation Plan

> For implementers: work task-by-task in order. Each task ends with its own test cycle and commit. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Token-bucket + sliding-window limiter component with a rate-limiting concept live on the generic loop.

**Architecture:** New pure `createRateLimiter` in sim-components; `runPreset` gains chain-node support (single-root guard, per-kind handlers, limiter config, `rejected` count); island needs only a one-line chaos-union widening since first-select rows already cover the algorithm control.

**Tech Stack:** TypeScript strict, Vitest, Next.js 14.2. No new dependencies. No sim-core changes.

**Spec:** `docs/superpowers/specs/2026-09-19-rate-limiting-design.md`

## Global Constraints

- TypeScript `strict: true` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`. No `as` casts.
- `packages/sim-core` untouched: zero deps, worker-safe, virtual time only, no RNG outside injected `Rng`.
- Determinism: same seed + topology + traffic gives identical results. Never weaken a test.
- Limiter is RNG-free; all time reads use `ctx.now`.
- Content: learn.mdx ≤600 words, no fabricated claims, challenges mirror lab verdicts.
- Small commits, one task each.

---

## File Map

- `packages/sim-components/src/rate-limiter.ts` — `createRateLimiter`, `RateLimiterOpts`, `LimiterAlgorithm` (new)
- `packages/sim-components/src/index.ts` — exports (modify)
- `packages/sim-components/tests/rate-limiter.test.ts` — unit + determinism (new)
- `packages/concept-engine/src/preset-run.ts` — chain support, `rejected` field (modify)
- `packages/concept-engine/src/schema.ts` — kind += `"rate-limiter"` (modify, 1 line)
- `packages/concept-engine/tests/preset-run.test.ts` — chain/kill/override tests (modify: append)
- `apps/web/components/concept-lab.tsx` — chaos union += rate-limiter (modify, 1 line)
- `content/concepts/rate-limiting/{meta.json,learn.mdx,lab.ts,challenges.json,recall.json}` (new)
- `apps/web/lib/presets.ts` — import + entry (modify)
- `packages/concept-engine/tests/rate-limiting-content.test.ts` (new)

---

### Task 1: limiter component

**Files:** Create `packages/sim-components/src/rate-limiter.ts`, `tests/rate-limiter.test.ts`. Modify `src/index.ts`.

**Interfaces:**
- Consumes: `EngineContext`, `HandlerFn`, `SimEvent` from sim-core (types only).
- Produces: `LimiterAlgorithm = "token-bucket" | "sliding-window"`; `RateLimiterOpts = { algorithm, rps: number, burst: number }`; `createRateLimiter(id: string, opts: RateLimiterOpts, downstream: string): { handler: HandlerFn; metrics: () => { allowed: number; rejected: number }; narrate: () => string }`.

- [ ] **Step 1: Write failing test**

```ts
// packages/sim-components/tests/rate-limiter.test.ts
import { describe, expect, it } from "vitest";
import { EventQueue, createRng } from "@backpressure/sim-core";
import type { EngineContext } from "@backpressure/sim-core";
import { createRateLimiter } from "../src/rate-limiter.js";

function ctx(): EngineContext & { forwarded: number; failed: number } {
  const box = { forwarded: 0, failed: 0 };
  const queue = new EventQueue();
  const context: EngineContext = {
    now: 0,
    queue,
    rng: createRng(1),
    complete: (_at: number, _lat: number, ok: boolean) => {
      if (ok) box.forwarded += 0;
      else box.failed += 1;
    },
  };
  return Object.assign(context, box);
}

function fire(handler: (e: never, c: EngineContext) => void, c: EngineContext, at: number, seq: number): void {
  c.now = at;
  handler({ at, seq, kind: "request", targetId: "lim" } as never, c);
}

describe("token-bucket", () => {
  it("absorbs burst 20, rejects 21st, refills over virtual time", () => {
    const lim = createRateLimiter("lim", { algorithm: "token-bucket", rps: 100, burst: 20 }, "svc");
    const c = ctx();
    for (let i = 0; i < 21; i += 1) fire(lim.handler, c, 0, i);
    expect(lim.metrics()).toEqual({ allowed: 20, rejected: 1 });
    fire(lim.handler, c, 100, 21);
    expect(lim.metrics().allowed).toBe(30);
  });

  it("is deterministic for identical sequences", () => {
    const run = (): { allowed: number; rejected: number } => {
      const lim = createRateLimiter("lim", { algorithm: "token-bucket", rps: 100, burst: 20 }, "svc");
      const c = ctx();
      [0, 0, 5, 50, 500, 500, 500].forEach((at, i) => fire(lim.handler, c, at, i));
      return lim.metrics();
    };
    expect(run()).toEqual(run());
  });
});

describe("sliding-window", () => {
  it("caps each 1s window and double-admits across the edge", () => {
    const lim = createRateLimiter("lim", { algorithm: "sliding-window", rps: 100, burst: 100 }, "svc");
    const c = ctx();
    for (let i = 0; i < 100; i += 1) fire(lim.handler, c, 999, i);
    for (let i = 0; i < 100; i += 1) fire(lim.handler, c, 1000, 100 + i);
    expect(lim.metrics()).toEqual({ allowed: 200, rejected: 0 });
    fire(lim.handler, c, 1001, 200);
    expect(lim.metrics().rejected).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL (missing module)**
  Run: `pnpm vitest run packages/sim-components/tests/rate-limiter.test.ts`

- [ ] **Step 3: Write minimal rate-limiter.ts**

```ts
// packages/sim-components/src/rate-limiter.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export type LimiterAlgorithm = "token-bucket" | "sliding-window";

export interface RateLimiterOpts {
  algorithm: LimiterAlgorithm;
  rps: number;
  burst: number;
}

export function createRateLimiter(
  id: string,
  opts: RateLimiterOpts,
  downstream: string,
): { handler: HandlerFn; metrics: () => { allowed: number; rejected: number }; narrate: () => string } {
  if (!Number.isFinite(opts.rps) || opts.rps <= 0) {
    throw new Error(`rate-limiter '${id}': rps must be a positive number`);
  }
  if (!Number.isFinite(opts.burst) || opts.burst <= 0) {
    throw new Error(`rate-limiter '${id}': burst must be a positive number`);
  }
  if (downstream.length === 0) throw new Error(`rate-limiter '${id}': missing downstream`);

  let allowed = 0;
  let rejected = 0;
  let tokens = opts.burst;
  let lastRefill = 0;
  let windowOf = -1;
  let windowCount = 0;

  function admitTokenBucket(now: number): boolean {
    tokens = Math.min(opts.burst, tokens + ((now - lastRefill) * opts.rps) / 1000);
    lastRefill = now;
    if (tokens >= 1) {
      tokens -= 1;
      return true;
    }
    return false;
  }

  function admitSlidingWindow(now: number): boolean {
    const window = Math.floor(now / 1000);
    if (window !== windowOf) {
      windowOf = window;
      windowCount = 0;
    }
    if (windowCount < opts.rps) {
      windowCount += 1;
      return true;
    }
    return false;
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request") return;
    const admit = opts.algorithm === "sliding-window" ? admitSlidingWindow(event.at) : admitTokenBucket(event.at);
    if (admit) {
      allowed += 1;
      ctx.queue.push(event.at, "request", downstream, event.payload);
    } else {
      rejected += 1;
      ctx.complete(ctx.now, 0, false);
    }
  }

  function metrics(): { allowed: number; rejected: number } {
    return { allowed, rejected };
  }

  function narrate(): string {
    return `limiter(${opts.algorithm} ${opts.rps}rps/burst ${opts.burst}): allowed=${allowed} rejected=${rejected}`;
  }

  return { handler, metrics, narrate };
}
```

Append to `src/index.ts`: `export { createRateLimiter }`, `export type { LimiterAlgorithm, RateLimiterOpts }`.

- [ ] **Step 4: Run `pnpm vitest run packages/sim-components && pnpm typecheck`, expect PASS.**
- [ ] **Step 5: Commit** `git add packages/sim-components && git commit -m "feat(sim-components): token-bucket + sliding-window rate limiter"`

### Task 2: schema kind + runPreset chain support

**Files:** Modify `packages/concept-engine/src/schema.ts` (1 line), `src/preset-run.ts`, `tests/preset-run.test.ts` (append), `apps/web/components/concept-lab.tsx` (1 line).

**Interfaces:**
- Consumes: `createRateLimiter` from Task 1; existing `LabPreset`, `PresetValues`, `Topology`.
- Produces: `PresetRunResult` += `rejected: number` (total `!ok` completions; island ignores it). Chain rules: exactly 1 root entry else throw; per-kind handlers (lb/service/rate-limiter); limiter downstream = single edge target else throw; dropBackend on a limiter id → all-down FAIL; unknown algorithm string → throw.

- [ ] **Step 1: Append chain tests (fail: no limiter support yet)**

```ts
describe("rate-limiter chain (limiter -> service, no lb)", () => {
  const chain = {
    id: "rl",
    topology: {
      nodes: [
        { id: "lim", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 100, burst: 20 } },
        { id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 50 } },
      ],
      edges: [{ from: "lim", to: "api" }],
    },
    controls: [],
    metrics: ["p99"],
    challenges: [{ id: "r1", text: "Hold", verdict: "slo.p99" }],
  } as const;

  it("sheds at 150 RPS with service drops at 0", () => {
    const preset = LabPresetSchema.parse(chain);
    const result = runPreset(preset, { rps: 150 });
    expect(result.rejected).toBeGreaterThan(0);
    expect(result.narration).toContain("dropped=0");
  });

  it("kill on limiter fails all-down, not crash", () => {
    const preset = LabPresetSchema.parse(chain);
    const result = runPreset(preset, { rps: 80 }, { dropBackend: "lim" });
    expect(result.verdict).toBe("FAIL");
    expect(result.narration).toContain("all backends down");
  });

  it("unknown algorithm throws", () => {
    const bad = LabPresetSchema.parse({
      ...chain,
      topology: {
        nodes: [
          { id: "lim", kind: "rate-limiter", config: { algorithm: "magic", rps: 100, burst: 20 } },
          { id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 50 } },
        ],
        edges: [{ from: "lim", to: "api" }],
      },
    });
    expect(() => runPreset(bad, { rps: 80 })).toThrow(/unknown algorithm/i);
  });

  it("multiple downstream targets throw", () => {
    const forked = LabPresetSchema.parse({
      ...chain,
      topology: {
        nodes: [
          { id: "lim", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 100, burst: 20 } },
          { id: "a", kind: "service", config: {} },
          { id: "b", kind: "service", config: {} },
        ],
        edges: [
          { from: "lim", to: "a" },
          { from: "lim", to: "b" },
        ],
      },
    });
    expect(() => runPreset(forked, { rps: 80 })).toThrow(/exactly 1 downstream/i);
  });
});
```

Note: `LabPresetSchema.parse(chain)` with `as const` kinds — `kind: "rate-limiter"` currently fails schema (kind enum lacks it) until the 1-line change; that is the RED. `config: {}` parses (record unknown) and falls back to service defaults.

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement (schema 1 line; preset-run.ts changes)**

schema.ts: `kind: z.enum(["lb", "service"])` → `z.enum(["lb", "service", "rate-limiter"])`.

preset-run.ts:
1. Import `createRateLimiter`.
2. `PresetRunResult` += `rejected: number`.
3. Roots guard after topology load:
```ts
const roots = topology.nodes.filter((n) => !topology.edges.some((e) => e.to === n.id)).map((n) => n.id);
if (roots.length !== 1) throw new Error(`preset '${preset.id}': expected exactly 1 entry node, found ${roots.length}`);
```
4. Limiter config resolver (algorithm may come from `values["algorithm"]` select or node config; numerics from node config or `nodeId.field` overrides):
```ts
function resolvedLimiterConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { algorithm: "token-bucket" | "sliding-window"; rps: number; burst: number } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const algoRaw: unknown = values["algorithm"] ?? base["algorithm"];
  if (algoRaw !== "token-bucket" && algoRaw !== "sliding-window") {
    throw new Error(`preset '${presetId}': unknown algorithm '${String(algoRaw)}'`);
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1 || key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    merged[key.slice(dot + 1)] = value;
  }
  return { algorithm: algoRaw, rps: numberField(merged, "rps", 100), burst: numberField(merged, "burst", 20) };
}
```
5. Chain wiring: collect `limiterNodes` (kind rate-limiter). If dropBackend matches one → return all-down FAIL (same shape). Graph build: include limiter nodes + edges limiter→target (validate exactly 1 downstream target). Register limiter handlers with resolved downstream. Narration: `[origin, ...limiters narrate, ...services narrate]`.
6. `rejected`: count `!ok` completions — engine `run` doesn't return them; track by wrapping handlers' `ctx.complete`? `run` owns ctx creation. Alternative: derive from limiter metrics sum + service drops parsed? Cleanest: sum `limiter.metrics().rejected` + count service `dropped`? Service exposes no dropped count (only queueDepth/inflight in metrics; narrate has it). Pragmatic: after run, parse service narrations? Ugly. Better: wrap `ctx.complete` — can't, engine-owned. Option: compute rejected = arrivals − ok completions. `run` returns metrics buckets (throughput incl errors, errors per bucket). Sum `errors` across metric points + ... errors bucket counts !ok. `MetricPoint {t,p50,p99,throughput,errors,trace}`. So `rejected = metrics.reduce(errors)`. Service drops + limiter rejects both !ok — combined total, exactly what rl tests need (service drops 0 asserted separately via narration `dropped=0`). Implement that.
7. Island 1 line: chaos union filter `node.kind === "service"` → `(node.kind === "service" || node.kind === "rate-limiter")`.

- [ ] **Step 4: Run full `pnpm vitest run packages && pnpm typecheck`; LB/SPOF parity tests must stay green. Expect PASS.**
- [ ] **Step 5: Commit** `git add packages/concept-engine apps/web/components/concept-lab.tsx && git commit -m "feat(engine): preset chain nodes + rejected count"`

### Task 3: rate-limiting concept + ship

**Files:** Create `content/concepts/rate-limiting/{meta.json,learn.mdx,lab.ts,challenges.json,recall.json}`, `packages/concept-engine/tests/rate-limiting-content.test.ts`. Modify `apps/web/lib/presets.ts`.

**Interfaces:** Consumes all above; zero island/page changes (content-only; any needed code change = interpreter gap, stop and report).

lab.ts (exact):

```ts
// content/concepts/rate-limiting/lab.ts
export const LAB_ID = "rate-limiting";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lim", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 100, burst: 20 } },
      { id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 50 } },
    ],
    edges: [{ from: "lim", to: "api" }],
  },
  controls: [
    { id: "algorithm", label: "Algorithm", kind: "select", options: ["token-bucket", "sliding-window"], def: "token-bucket" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "lim.burst", label: "Bucket burst", kind: "slider", min: 5, max: 100, def: 20 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "rl.1", text: "Hold 150 RPS with the service staying clean", verdict: "slo.p99", apply: { set: { rps: 150 } }, show: "token-bucket" },
    { id: "rl.2", text: "Raise burst 20 to 100 at 150 RPS and watch rejected fall", verdict: "slo.p99", apply: { set: { rps: 150, "lim.burst": 100 } }, show: "token-bucket" },
  ],
};
```

Note: `show` matches row labels = algorithm option strings (first-select expansion). `lim.burst` slider also affects sliding-window rows harmlessly (ignored — window uses rps cap only; document in Learn? No: burst slider only meaningful for token-bucket; sliding-window ignores it. Learn states this in one line. Honest, no hidden behavior.)

meta.json: `{ id, title "Rate Limiting", prerequisites ["load-balancing"], difficulty "intermediate", estimated_minutes 20, tags ["traffic","tier-2"] }`.
challenges.json mirrors lab.ts. recall.json 4 items (why limit / token vs window / what 429s mean / per-key vs global line).
learn.mdx ~200 words: protect-origin why, token-bucket smooth + burst, sliding-window edge math (2× worked: 100 at :999 + 100 at :1000), leaky prose mirror, per-key/global interview line, burst-slider-note line.

Content test (behavioral via runPreset): validation + wordcount + 80-rejects-0 + 150-sheds-service-clean (`rejected>0`, narration `dropped=0`) + burst100 rejects < burst20 rejects at 150.

- [ ] **Step 1: Write 5 content files + presets.ts entry.**
- [ ] **Step 2: Write content test, run it.**
- [ ] **Step 3: `pnpm typecheck && pnpm test && pnpm --filter web build` (7 routes). Manual checklist: algorithm flip, 150 RPS 429s, burst slider, chaos, reload.**
- [ ] **Step 4: Commit** `git add content/concepts/rate-limiting apps/web/lib/presets.ts packages/concept-engine/tests/rate-limiting-content.test.ts && git commit -m "feat(content): rate-limiting concept"`

## Self-Review

- Spec component semantics → Task 1 (exact narrate format, arrival preservation, 429 completes).
- Spec preset numbers → Task 3 (100/20, 20–300, service 20ms/c4).
- Spec interpreter/schema → Task 2 (kind, chain, no new controls, chaos union, canvas deferred).
- Spec testing → Tasks 1–3 (determinism, bucket math, boundary pin, integration, content).
- Type consistency: `LimiterAlgorithm/RateLimiterOpts/createRateLimiter/PresetRunResult.rejected` uniform.
- rl.2 reframe already in spec (committed 572533e); boundary pinned at handler level, Learn math, no lab fiction.
