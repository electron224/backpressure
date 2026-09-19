# M1a Concept Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interactive four-stage load-balancing concept page (Learn/Play/Stress/Recall) with predict-then-reveal and chaos button, progress in localStorage, no auth/DB.

**Architecture:** Thin Next.js server loads and Zod-validates content, renders Learn prose; a client island runs the M0 engine in-browser (sub-ms runs, no Worker yet) for Play/Stress/Predict/Chaos; a pure-TS concept-engine lib holds schemas, prediction math, deterministic chaos, and a Storage-injected progress adapter.

**Tech Stack:** Next.js 14.2 + React 18.3 + Tailwind 3.4, TypeScript strict, zod 3.23, next-mdx-remote 5.x, Vitest (lib tests), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-19-m1a-design.md`

## Global Constraints

- TypeScript `strict: true` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`. No `as` casts to silence the compiler.
- `packages/sim-core` stays zero dependencies and worker-safe (no DOM, no `window`, no `Math.random`, no `Date.now`). Do not modify `sim-core` or `sim-components` behavior in this plan.
- Same seed + topology + traffic ⇒ byte-identical event log (M0 determinism suite must stay green).
- Pass/fail comes from simulator `Verdicts` only. No LLM anywhere.
- Every simulation comprehensible without color vision and without a mouse: keyboard-operable controls, tabular data view, text labels on every state change.
- Naming: `PascalCase` components, `camelCase` functions, `SCREAMING_SNAKE` constants, `kebab-case` files and content slugs.
- Small commits, one task per commit group. Never weaken a test to pass.

---

## File Map

- `packages/concept-engine/package.json` — deps: `@backpressure/sim-core: workspace:*`, `zod: 3.23.8`
- `packages/concept-engine/src/schema.ts` — `ConceptMeta`, `Challenge`, `RecallItem` Zod schemas + inferred types
- `packages/concept-engine/src/predict.ts` — `predictionError`, `gradePrediction`
- `packages/concept-engine/src/chaos.ts` — `pickRandomFault`
- `packages/concept-engine/src/progress.ts` — `createProgress` over injected `StorageLike`
- `packages/concept-engine/src/index.ts` — re-exports
- `packages/concept-engine/tests/schema.test.ts`, `predict.test.ts`, `chaos.test.ts`, `progress.test.ts`
- `content/concepts/load-balancing/meta.json`, `learn.mdx`, `challenges.json`, `recall.json`
- `content/concepts/load-balancing/learn-wordcount.test.ts` — placed in `packages/concept-engine/tests/` as `learn-wordcount.test.ts` (vitest include only covers `packages/*/tests/`, so the test must live there; it reads the mdx from disk)
- `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/concepts/[slug]/page.tsx`
- `apps/web/lib/content.ts` — server-only loader (node `fs`/`path`)
- `apps/web/components/concept-lab.tsx` — client island
- `apps/web/components/metric-table.tsx` — client table
- Modify: `pnpm-workspace.yaml` (add `apps/*`), `tsconfig.json` (add `jsx: react-jsx`, `lib` DOM, `apps/**` include)

---

### Task 1: concept-engine schema + predict

**Files:**
- Create: `packages/concept-engine/package.json`
- Create: `packages/concept-engine/src/schema.ts`
- Create: `packages/concept-engine/src/predict.ts`
- Create: `packages/concept-engine/src/index.ts`
- Test: `packages/concept-engine/tests/schema.test.ts`, `packages/concept-engine/tests/predict.test.ts`

**Interfaces:**
- Consumes: `zod` only
- Produces:
  - `ConceptMeta = { id: string; title: string; prerequisites: string[]; difficulty: "beginner" | "intermediate" | "advanced"; estimated_minutes: number; tags: string[] }`
  - `Challenge = { id: string; text: string; verdict: string }`
  - `RecallItem = { id: string; q: string; a: string }`
  - `ConceptMetaSchema`, `ChallengesSchema`, `RecallItemsSchema` (zod objects/arrays)
  - `predictionError(predictedMs: number, actualMs: number): number`
  - `gradePrediction(errorMs: number, toleranceMs?: number): boolean` (default tolerance 50)

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@backpressure/concept-engine",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@backpressure/sim-core": "workspace:*",
    "zod": "3.23.8"
  }
}
```

- [ ] **Step 2: Write failing schema test**

```ts
// packages/concept-engine/tests/schema.test.ts
import { describe, expect, it } from "vitest";
import { ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";

describe("ConceptMetaSchema", () => {
  it("accepts a valid meta", () => {
    const parsed = ConceptMetaSchema.parse({
      id: "load-balancing",
      title: "Load Balancing",
      prerequisites: [],
      difficulty: "beginner",
      estimated_minutes: 20,
      tags: ["traffic"],
    });
    expect(parsed.id).toBe("load-balancing");
  });

  it("rejects a bad difficulty", () => {
    expect(() =>
      ConceptMetaSchema.parse({
        id: "x",
        title: "X",
        prerequisites: [],
        difficulty: "expert",
        estimated_minutes: 5,
        tags: [],
      }),
    ).toThrow();
  });
});

describe("ChallengesSchema", () => {
  it("rejects an empty list", () => {
    expect(() => ChallengesSchema.parse([])).toThrow();
  });
});

describe("RecallItemsSchema", () => {
  it("rejects an item missing an answer", () => {
    expect(() => RecallItemsSchema.parse([{ id: "r1", q: "Why?" }])).toThrow();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run packages/concept-engine/tests/schema.test.ts`
Expected: FAIL with "Failed to resolve import" (schema.ts missing)

- [ ] **Step 4: Write minimal schema.ts**

```ts
// packages/concept-engine/src/schema.ts
import { z } from "zod";

export const ConceptMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prerequisites: z.array(z.string()),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimated_minutes: z.number().int().positive(),
  tags: z.array(z.string()),
});

export type ConceptMeta = z.infer<typeof ConceptMetaSchema>;

export const ChallengeSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  verdict: z.string().min(1),
});

export type Challenge = z.infer<typeof ChallengeSchema>;

export const ChallengesSchema = z.array(ChallengeSchema).min(1);

export const RecallItemSchema = z.object({
  id: z.string().min(1),
  q: z.string().min(1),
  a: z.string().min(1),
});

export type RecallItem = z.infer<typeof RecallItemSchema>;

export const RecallItemsSchema = z.array(RecallItemSchema).min(1);
```

- [ ] **Step 5: Write failing predict test**

```ts
// packages/concept-engine/tests/predict.test.ts
import { describe, expect, it } from "vitest";
import { gradePrediction, predictionError } from "../src/predict.js";

describe("predictionError", () => {
  it("is the absolute difference", () => {
    expect(predictionError(100, 146)).toBe(46);
    expect(predictionError(200, 146)).toBe(54);
  });
});

describe("gradePrediction", () => {
  it("passes within the default 50ms tolerance", () => {
    expect(gradePrediction(46)).toBe(true);
    expect(gradePrediction(54)).toBe(false);
  });

  it("respects a custom tolerance boundary", () => {
    expect(gradePrediction(100, 100)).toBe(true);
    expect(gradePrediction(101, 100)).toBe(false);
  });
});
```

- [ ] **Step 6: Write minimal predict.ts + index.ts**

```ts
// packages/concept-engine/src/predict.ts
export const DEFAULT_PREDICTION_TOLERANCE_MS = 50;

export function predictionError(predictedMs: number, actualMs: number): number {
  return Math.abs(predictedMs - actualMs);
}

export function gradePrediction(errorMs: number, toleranceMs: number = DEFAULT_PREDICTION_TOLERANCE_MS): boolean {
  if (!(toleranceMs >= 0)) {
    throw new Error(`tolerance must be >= 0, got ${toleranceMs}`);
  }
  return errorMs <= toleranceMs;
}
```

```ts
// packages/concept-engine/src/index.ts
export {
  ChallengeSchema,
  ChallengesSchema,
  ConceptMetaSchema,
  RecallItemSchema,
  RecallItemsSchema,
} from "./schema.js";
export type { Challenge, ConceptMeta, RecallItem } from "./schema.js";
export { DEFAULT_PREDICTION_TOLERANCE_MS, gradePrediction, predictionError } from "./predict.js";
```

- [ ] **Step 7: Install, run tests, typecheck**

Run: `pnpm install && pnpm vitest run packages/concept-engine && pnpm typecheck`
Expected: PASS (8 tests), typecheck clean

- [ ] **Step 8: Commit**

```bash
git add packages/concept-engine
git commit -m "feat(concept-engine): content schemas + prediction grading"
```

---

### Task 2: concept-engine chaos + progress

**Files:**
- Create: `packages/concept-engine/src/chaos.ts`
- Create: `packages/concept-engine/src/progress.ts`
- Modify: `packages/concept-engine/src/index.ts` (append chaos + progress exports)
- Test: `packages/concept-engine/tests/chaos.test.ts`, `packages/concept-engine/tests/progress.test.ts`

**Interfaces:**
- Consumes: `Rng`, `ScenarioEvent` from `@backpressure/sim-core`; schemas from Task 1
- Produces:
  - `pickRandomFault(rng: Rng, backends: string[]): ScenarioEvent` — `rng.next() < 0.6` → `{ at: 2500, fault: "kill-node", targets: [one backend] }`, else `{ at: 2500, fault: "traffic-spike", rps: 160 }`. Throws on empty backends. The web island interprets kill-node as "drop that backend, re-run" and traffic-spike as "re-run at fault.rps".
  - `StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }` (browser `Storage` satisfies this; defined locally so Node tests need no DOM lib)
  - `PredictionRecord = { predicted: number; actual: number; error: number }`
  - `createProgress(store: StorageLike)` → `{ completeStage(slug: string, stage: string): void; logPrediction(slug: string, record: PredictionRecord): void; get(slug: string): { stages: string[]; predictions: PredictionRecord[] } }`. Corrupt JSON resets that key, never throws.

- [ ] **Step 1: Write failing chaos test**

```ts
// packages/concept-engine/tests/chaos.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "@backpressure/sim-core";
import { pickRandomFault } from "../src/chaos.js";

describe("pickRandomFault", () => {
  it("is deterministic for the same seed", () => {
    const a = pickRandomFault(createRng(3), ["fast", "slow"]);
    const b = pickRandomFault(createRng(3), ["fast", "slow"]);
    expect(a).toEqual(b);
  });

  it("targets a real backend on kill-node", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const fault = pickRandomFault(createRng(seed), ["fast", "slow"]);
      if (fault.fault === "kill-node") {
        expect(["fast", "slow"]).toContain(fault.targets?.[0]);
      } else {
        expect(fault.fault).toBe("traffic-spike");
      }
    }
  });

  it("throws on empty backends", () => {
    expect(() => pickRandomFault(createRng(1), [])).toThrow(/backend/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/concept-engine/tests/chaos.test.ts`
Expected: FAIL with "Failed to resolve import" (chaos.ts missing)

- [ ] **Step 3: Write minimal chaos.ts**

```ts
// packages/concept-engine/src/chaos.ts
import type { Rng, ScenarioEvent } from "@backpressure/sim-core";

export const CHAOS_KILL_PROBABILITY = 0.6;
export const CHAOS_FAULT_AT_MS = 2500;
export const CHAOS_SPIKE_RPS = 160;

export function pickRandomFault(rng: Rng, backends: string[]): ScenarioEvent {
  if (backends.length === 0) {
    throw new Error("pickRandomFault needs at least one backend");
  }
  if (rng.next() < CHAOS_KILL_PROBABILITY) {
    const target = backends[rng.nextInt(backends.length)];
    if (target === undefined) throw new Error("pickRandomFault drew no backend");
    return { at: CHAOS_FAULT_AT_MS, fault: "kill-node", targets: [target] };
  }
  return { at: CHAOS_FAULT_AT_MS, fault: "traffic-spike", rps: CHAOS_SPIKE_RPS };
}
```

- [ ] **Step 4: Write failing progress test**

```ts
// packages/concept-engine/tests/progress.test.ts
import { describe, expect, it } from "vitest";
import { createProgress } from "../src/progress.js";
import type { StorageLike } from "../src/progress.js";

function memoryStore(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

describe("createProgress", () => {
  it("round-trips stages and predictions", () => {
    const progress = createProgress(memoryStore());
    progress.completeStage("load-balancing", "play");
    progress.logPrediction("load-balancing", { predicted: 100, actual: 146, error: 46 });
    const state = progress.get("load-balancing");
    expect(state.stages).toContain("play");
    expect(state.predictions).toEqual([{ predicted: 100, actual: 146, error: 46 }]);
  });

  it("does not duplicate a completed stage", () => {
    const progress = createProgress(memoryStore());
    progress.completeStage("load-balancing", "play");
    progress.completeStage("load-balancing", "play");
    expect(progress.get("load-balancing").stages).toEqual(["play"]);
  });

  it("recovers from corrupt JSON instead of throwing", () => {
    const store = memoryStore();
    store.setItem("bp:load-balancing", "{broken");
    const progress = createProgress(store);
    expect(() => progress.get("load-balancing")).not.toThrow();
    expect(progress.get("load-balancing")).toEqual({ stages: [], predictions: [] });
  });
});
```

- [ ] **Step 5: Write minimal progress.ts + extend index.ts**

```ts
// packages/concept-engine/src/progress.ts
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PredictionRecord {
  predicted: number;
  actual: number;
  error: number;
}

export interface ConceptProgress {
  stages: string[];
  predictions: PredictionRecord[];
}

const EMPTY: ConceptProgress = { stages: [], predictions: [] };

function keyFor(slug: string): string {
  return `bp:${slug}`;
}

export function createProgress(store: StorageLike): {
  completeStage: (slug: string, stage: string) => void;
  logPrediction: (slug: string, record: PredictionRecord) => void;
  get: (slug: string) => ConceptProgress;
} {
  function get(slug: string): ConceptProgress {
    const raw = store.getItem(keyFor(slug));
    if (raw === null) return { stages: [], predictions: [] };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return { ...EMPTY, stages: [], predictions: [] };
      const record = parsed as { stages?: unknown; predictions?: unknown };
      const stages = Array.isArray(record.stages) ? record.stages.filter((s): s is string => typeof s === "string") : [];
      const predictions = Array.isArray(record.predictions)
        ? record.predictions.filter(
            (p): p is PredictionRecord =>
              typeof p === "object" &&
              p !== null &&
              typeof (p as { predicted?: unknown }).predicted === "number" &&
              typeof (p as { actual?: unknown }).actual === "number" &&
              typeof (p as { error?: unknown }).error === "number",
          )
        : [];
      return { stages, predictions };
    } catch {
      store.removeItem(keyFor(slug));
      return { stages: [], predictions: [] };
    }
  }

  function put(slug: string, state: ConceptProgress): void {
    store.setItem(keyFor(slug), JSON.stringify(state));
  }

  function completeStage(slug: string, stage: string): void {
    const state = get(slug);
    if (!state.stages.includes(stage)) {
      put(slug, { ...state, stages: [...state.stages, stage] });
    }
  }

  function logPrediction(slug: string, record: PredictionRecord): void {
    const state = get(slug);
    put(slug, { ...state, predictions: [...state.predictions, record] });
  }

  return { completeStage, logPrediction, get };
}
```

Append to `packages/concept-engine/src/index.ts`:

```ts
export { CHAOS_FAULT_AT_MS, CHAOS_KILL_PROBABILITY, CHAOS_SPIKE_RPS, pickRandomFault } from "./chaos.js";
export { createProgress } from "./progress.js";
export type { ConceptProgress, PredictionRecord, StorageLike } from "./progress.js";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm vitest run packages/concept-engine && pnpm typecheck`
Expected: PASS (8 + 6 = 14 tests)

- [ ] **Step 7: Commit**

```bash
git add packages/concept-engine
git commit -m "feat(concept-engine): deterministic chaos + localStorage progress"
```

---

### Task 3: load-balancing four-stage content

**Files:**
- Create: `content/concepts/load-balancing/meta.json`
- Create: `content/concepts/load-balancing/learn.mdx` (≤600 words)
- Create: `content/concepts/load-balancing/challenges.json`
- Create: `content/concepts/load-balancing/recall.json`
- Test: `packages/concept-engine/tests/learn-wordcount.test.ts` (reads mdx from disk, asserts ≤600 words)

**Interfaces:**
- Consumes: `ConceptMetaSchema`, `ChallengesSchema`, `RecallItemsSchema` from Task 1 (content must validate; add a validation test in this task using node `fs`)
- Produces: four files the web loader (Task 4) reads verbatim

- [ ] **Step 1: Write meta.json**

```json
{
  "id": "load-balancing",
  "title": "Load Balancing",
  "prerequisites": [],
  "difficulty": "beginner",
  "estimated_minutes": 20,
  "tags": ["traffic", "tier-2"]
}
```

- [ ] **Step 2: Write learn.mdx (≤600 words, prose names things; lab teaches)**

```mdx
# Load Balancing

A load balancer sits in front of a fleet of servers and decides, per request, which server handles it. One address in, N servers out.

## Why it exists

Servers fail, deploy, and saturate. Without a balancer, clients pin to specific machines and inherit their fate. With one, capacity is pooled: add servers, survive failures, and upgrade without downtime.

## The strategies

- **Round-robin** deals requests evenly, one after another. No state, no measurement. Fair only when servers are identical.
- **Least-connections** sends each request to the server with the fewest in-flight requests. Adapts to slow or sick servers automatically.
- **Weighted** assigns fixed shares (e.g. 3:1) for fleets with known capacity differences.
- **Consistent hashing** routes by key so the same key usually lands on the same server. Useful when servers cache.

## The failure mode to remember

Round-robin on a **heterogeneous** fleet — one fast server, one slow — gives both equal share. The slow server queues, latency follows the slow path, and p99 explodes while the fast server idles. Least-connections avoids this by following actual load.

## Interview line

"Use least-connections (or weighted) for heterogeneous fleets; round-robin only when servers are identical. Watch queue depth per backend, not just average latency."
```

- [ ] **Step 3: Write challenges.json (mirrors lab.ts verdicts)**

```json
[
  { "id": "lb.1", "text": "Keep p99 under 150ms at 80 RPS by switching strategy", "verdict": "slo.p99" },
  { "id": "lb.2", "text": "Push to 120 RPS and report RR vs LC p99 divergence", "verdict": "slo.p99" }
]
```

- [ ] **Step 4: Write recall.json**

```json
[
  { "id": "lb-r1", "q": "Why does round-robin overload a heterogeneous fleet?", "a": "It deals equal share regardless of speed, so the slow server queues and p99 follows the slow path." },
  { "id": "lb-r2", "q": "What signal does least-connections follow?", "a": "Fewest in-flight requests per backend, which adapts to slow or sick servers automatically." },
  { "id": "lb-r3", "q": "When is round-robin safe?", "a": "When servers are identical in capacity and requests cost roughly the same." },
  { "id": "lb-r4", "q": "What per-backend metric reveals the overload first?", "a": "Queue depth on the slow backend, before average latency moves much." }
]
```

- [ ] **Step 5: Write validation + word-count test**

```ts
// packages/concept-engine/tests/load-balancing-content.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "../src/schema.js";

const DIR = "../../content/concepts/load-balancing";

describe("load-balancing content", () => {
  it("meta validates", () => {
    const meta: unknown = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8"));
    expect(ConceptMetaSchema.parse(meta).id).toBe("load-balancing");
  });

  it("challenges validate", () => {
    const challenges: unknown = JSON.parse(readFileSync(`${DIR}/challenges.json`, "utf8"));
    expect(ChallengesSchema.parse(challenges)).toHaveLength(2);
  });

  it("recall validates", () => {
    const recall: unknown = JSON.parse(readFileSync(`${DIR}/recall.json`, "utf8"));
    expect(RecallItemsSchema.parse(recall)).toHaveLength(4);
  });

  it("learn.mdx is under 600 words", () => {
    const mdx = readFileSync(`${DIR}/learn.mdx`, "utf8");
    const words = mdx.split(/\s+/).filter((w) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(600);
  });
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm vitest run packages/concept-engine/tests/load-balancing-content.test.ts && pnpm typecheck`
Expected: PASS (word count is ~230)

- [ ] **Step 7: Commit**

```bash
git add content/concepts/load-balancing packages/concept-engine/tests/load-balancing-content.test.ts
git commit -m "feat(content): load-balancing four-stage content"
```

---

### Task 4: apps/web scaffold + content loader + concept page

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/concepts/[slug]/page.tsx`, `apps/web/lib/content.ts`
- Modify: `pnpm-workspace.yaml` (append `  - "apps/*"`), `tsconfig.json` (add `jsx: react-jsx`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `apps/**/*.ts(x)` includes)
- Test: manual `pnpm --filter web dev` smoke + `pnpm typecheck` (no vitest for app shell in M1a; island logic covered by concept-engine tests + Task 5 manual ship)

**Interfaces:**
- Consumes: content files from Task 3, `ConceptMetaSchema/ChallengesSchema/RecallItemsSchema` from concept-engine, `labPreset` from `content/concepts/load-balancing/lab.ts`
- Produces: `getConcept(slug: string): { meta: ConceptMeta; learnMdx: string; challenges: Challenge[]; recall: RecallItem[] }` (throws with file+field context on invalid content); route `/concepts/load-balancing` rendering Learn + island (island itself is Task 5)

- [ ] **Step 1: Extend pnpm-workspace.yaml**

Old:

```yaml
packages:
  - "packages/*"
  - "demo"
```

New:

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "demo"
```

- [ ] **Step 2: Extend root tsconfig.json**

Add `"jsx": "react-jsx"` and `"lib": ["ES2022", "DOM", "DOM.Iterable"]` to `compilerOptions`, and `"apps/**/*.ts"`, `"apps/**/*.tsx"` to `include`. Keep `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `types: ["node"]`.

- [ ] **Step 3: Write apps/web/package.json**

```json
{
  "name": "@backpressure/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  },
  "dependencies": {
    "@backpressure/concept-engine": "workspace:*",
    "@backpressure/sim-components": "workspace:*",
    "@backpressure/sim-core": "workspace:*",
    "next": "14.2.18",
    "next-mdx-remote": "5.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/node": "26.6.2",
    "@types/react": "18.3.12",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.15",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 4: Write Next/Tailwind scaffolding**

```js
// apps/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

```ts
// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

```js
// apps/web/postcss.config.mjs
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

```css
/* apps/web/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// apps/web/app/page.tsx
import Link from "next/link";

export default function Home(): JSX.Element {
  return (
    <main>
      <h1>Backpressure</h1>
      <p>Learn system design by running it.</p>
      <Link href="/concepts/load-balancing">Load Balancing</Link>
    </main>
  );
}
```

- [ ] **Step 5: Write server-only content loader**

```ts
// apps/web/lib/content.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ChallengesSchema, ConceptMetaSchema, RecallItemsSchema } from "@backpressure/concept-engine";
import type { Challenge, ConceptMeta, RecallItem } from "@backpressure/concept-engine";

const CONCEPTS_DIR = join(process.cwd(), "..", "..", "content", "concepts");

export interface ConceptContent {
  meta: ConceptMeta;
  learnMdx: string;
  challenges: Challenge[];
  recall: RecallItem[];
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`concept content unreadable at ${path}: ${String(error)}`);
  }
}

export function getConcept(slug: string): ConceptContent {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`invalid concept slug: ${slug}`);
  const dir = join(CONCEPTS_DIR, slug);
  const meta = ConceptMetaSchema.parse(readJson(join(dir, "meta.json")));
  const challenges = ChallengesSchema.parse(readJson(join(dir, "challenges.json")));
  const recall = RecallItemsSchema.parse(readJson(join(dir, "recall.json")));
  let learnMdx: string;
  try {
    learnMdx = readFileSync(join(dir, "learn.mdx"), "utf8");
  } catch (error) {
    throw new Error(`concept content unreadable at ${dir}/learn.mdx: ${String(error)}`);
  }
  return { meta, learnMdx, challenges, recall };
}
```

- [ ] **Step 6: Write concept page (Learn + island placeholder — island lands in Task 5)**

```tsx
// apps/web/app/concepts/[slug]/page.tsx
import { serialize } from "next-mdx-remote/serialize";
import { MDXRemote } from "next-mdx-remote";
import { ConceptLab } from "../../../components/concept-lab.js";
import { getConcept } from "../../../lib/content.js";

export function generateStaticParams(): { slug: string }[] {
  return [{ slug: "load-balancing" }];
}

export default async function ConceptPage({ params }: { params: { slug: string } }): Promise<JSX.Element> {
  const concept = getConcept(params.slug);
  const mdxSource = await serialize(concept.learnMdx);
  return (
    <main>
      <h1>{concept.meta.title}</h1>
      <section aria-label="Learn">
        <MDXRemote {...mdxSource} />
      </section>
      <ConceptLab slug={concept.meta.id} challenges={concept.challenges} recall={concept.recall} />
    </main>
  );
}
```

- [ ] **Step 7: Install, typecheck, dev smoke**

Run: `pnpm install && pnpm typecheck`
Expected: PASS (page will fail at build until Task 5 creates the island — `pnpm --filter web build` is expected to fail here with "Cannot find module concept-lab"; record that, do not stub around it)

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-workspace.yaml tsconfig.json
git commit -m "feat(web): Next.js shell + concept content loader"
```

---

### Task 5: concept-lab client island + metric table

**Files:**
- Create: `apps/web/components/metric-table.tsx`
- Create: `apps/web/components/concept-lab.tsx`
- Test: manual ship checklist (no new vitest; engine + concept-engine suites must stay green): load page, move RPS slider, commit prediction, hit chaos, attempt both challenges, reveal recall, reload (progress persists)

**Interfaces:**
- Consumes: `compile`, `run`, `createRng` from sim-core; `createService`, `createLoadBalancer` from sim-components; `predictionError`, `gradePrediction`, `pickRandomFault`, `createProgress` from concept-engine; `labPreset` topology + service configs; `Challenge[]`, `RecallItem[]` props from the page
- Produces: working `/concepts/load-balancing` four-stage loop; `pnpm --filter web build` green

Sim-run wiring (mirrors `demo/run.ts`, seed 7 default): compile `{lb, fast, slow}` graph from `labPreset.topology`; services from preset `serviceMs/concurrency/queueLimit`; LB `pick` fed by live `service.metrics().inflight + queueDepth`; kill-node chaos drops the target backend and re-runs; traffic-spike chaos re-runs at `fault.rps`.

- [ ] **Step 1: Write metric-table.tsx (tabular, text PASS/FAIL, keyboard-safe)**

```tsx
// apps/web/components/metric-table.tsx
"use client";

export interface LabRow {
  strategy: string;
  p99: number;
  verdict: "PASS" | "FAIL";
  narration: string;
}

export function MetricTable({ rows }: { rows: LabRow[] }): JSX.Element {
  return (
    <table>
      <caption>Simulation results by strategy</caption>
      <thead>
        <tr>
          <th scope="col">Strategy</th>
          <th scope="col">p99 (ms)</th>
          <th scope="col">SLO 150ms</th>
          <th scope="col">What happened</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.strategy}>
            <th scope="row">{row.strategy}</th>
            <td>{Math.round(row.p99)}</td>
            <td>{row.verdict}</td>
            <td>{row.narration}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Write concept-lab.tsx (Play/Predict/Chaos/Stress/Recall)**

```tsx
// apps/web/components/concept-lab.tsx
"use client";

import { useMemo, useState } from "react";
import { compile, createRng, run } from "@backpressure/sim-core";
import type { HandlerFn } from "@backpressure/sim-core";
import { createLoadBalancer, createService } from "@backpressure/sim-components";
import type { LbStrategy } from "@backpressure/sim-components";
import {
  createProgress,
  gradePrediction,
  pickRandomFault,
  predictionError,
} from "@backpressure/concept-engine";
import { labPreset } from "../../../../content/concepts/load-balancing/lab.js";
import type { Challenge, RecallItem } from "@backpressure/concept-engine";
import { MetricTable } from "./metric-table.js";
import type { LabRow } from "./metric-table.js";

const SEED = 7;
const SLO_P99_MS = 150;

interface ServiceConfig {
  serviceMs: number;
  concurrency: number;
  queueLimit: number;
}

function serviceConfig(id: string): ServiceConfig {
  const node = labPreset.topology.nodes.find((n) => n.id === id);
  const config = (node?.config ?? {}) as Partial<ServiceConfig>;
  return {
    serviceMs: config.serviceMs ?? 20,
    concurrency: config.concurrency ?? 2,
    queueLimit: config.queueLimit ?? 50,
  };
}

function runStrategy(strategy: LbStrategy, rps: number, dropBackend?: string): { p99: number; narration: string } {
  const backends = ["fast", "slow"].filter((b) => b !== dropBackend);
  const graph = compile({
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      ...backends.map((b) => ({ id: b, kind: "service", config: {} })),
    ],
    edges: backends.map((b) => ({ from: "lb", to: b })),
  });
  const services = new Map(backends.map((b) => [b, createService(b, serviceConfig(b))]));
  const lb = createLoadBalancer({ strategy, backends });
  const handlers = new Map<string, HandlerFn>([
    [
      "lb",
      (event, ctx) => {
        const target = lb.pick((id) => {
          const svc = services.get(id);
          const m = svc?.metrics();
          return (m?.inflight ?? 0) + (m?.queueDepth ?? 0);
        });
        ctx.queue.push(event.at, "request", target, { arrival: event.at });
      },
    ],
  ]);
  for (const [id, svc] of services) handlers.set(id, svc.handler);
  const result = run({ seed: SEED, graph, traffic: { rps, durationMs: 5000 }, handlers, sloP99Ms: SLO_P99_MS });
  const p99 = result.verdicts.find((v) => v.id === "slo.p99")?.observed ?? 0;
  const narration = [lb.narrate(), ...[...services.values()].map((s) => s.narrate())].join(" | ");
  return { p99, narration };
}

export function ConceptLab({ slug, challenges, recall }: { slug: string; challenges: Challenge[]; recall: RecallItem[] }): JSX.Element {
  const progress = useMemo(() => createProgress(window.localStorage), []);
  const [strategy, setStrategy] = useState<LbStrategy>("round-robin");
  const [rps, setRps] = useState<number>(80);
  const [prediction, setPrediction] = useState<number>(150);
  const [committed, setCommitted] = useState<number | null>(null);
  const [chaosNote, setChaosNote] = useState<string>("No fault injected yet.");
  const [dropped, setDropped] = useState<string | undefined>(undefined);
  const [chaosRps, setChaosRps] = useState<number | undefined>(undefined);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const effectiveRps = chaosRps ?? rps;
  const rows: LabRow[] = (["round-robin", "least-connections"] as LbStrategy[]).map((s) => {
    const { p99, narration } = runStrategy(s, effectiveRps, dropped);
    return { strategy: s, p99, verdict: p99 <= SLO_P99_MS ? "PASS" : "FAIL", narration };
  });
  const current = rows.find((r) => r.strategy === strategy);
  const actual = current?.p99 ?? 0;

  function commitPrediction(): void {
    setCommitted(prediction);
    const error = predictionError(prediction, actual);
    progress.logPrediction(slug, { predicted: prediction, actual, error });
    progress.completeStage(slug, "predict");
  }

  function injectChaos(): void {
    const fault = pickRandomFault(createRng(Date.now() % 2147483647), ["fast", "slow"]);
    if (fault.fault === "kill-node") {
      const target = fault.targets?.[0] ?? "slow";
      setDropped(target);
      setChaosRps(undefined);
      setChaosNote(`Chaos: killed ${target}. Re-run shows the surviving backend alone.`);
    } else {
      setDropped(undefined);
      setChaosRps(fault.rps ?? 160);
      setChaosNote(`Chaos: traffic spike to ${fault.rps ?? 160} RPS for this run.`);
    }
    progress.completeStage(slug, "play");
  }

  return (
    <div>
      <section aria-label="Play">
        <h2>Play</h2>
        <label>
          Strategy
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as LbStrategy)}>
            <option value="round-robin">round-robin</option>
            <option value="least-connections">least-connections</option>
          </select>
        </label>
        <label>
          Traffic (RPS): {rps}
          <input type="range" min={10} max={300} value={rps} onChange={(e) => setRps(Number(e.target.value))} />
        </label>
        <MetricTable rows={rows} />
      </section>

      <section aria-label="Predict then reveal">
        <h2>Predict, then reveal</h2>
        <label>
          What will p99 be at {effectiveRps} RPS with {strategy}? {prediction}ms
          <input type="range" min={0} max={3000} value={prediction} onChange={(e) => setPrediction(Number(e.target.value))} disabled={committed !== null} />
        </label>
        {committed === null ? (
          <button type="button" onClick={commitPrediction}>
            Commit prediction and run
          </button>
        ) : (
          <p>
            You predicted {committed}ms; actual {Math.round(actual)}ms; error {Math.round(predictionError(committed, actual))}ms —{" "}
            {gradePrediction(predictionError(committed, actual)) ? "within 50ms, nice." : "off by more than 50ms."}{" "}
            <button type="button" onClick={() => setCommitted(null)}>
              Predict again
            </button>
          </p>
        )}
      </section>

      <section aria-label="Chaos">
        <h2>Chaos button</h2>
        <button type="button" onClick={injectChaos}>
          Inject random fault
        </button>
        <p>{chaosNote}</p>
      </section>

      <section aria-label="Stress">
        <h2>Stress</h2>
        <ul>
          {challenges.map((c) => (
            <li key={c.id}>
              {c.text} — verdict: {c.verdict}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Recall">
        <h2>Recall</h2>
        <ul>
          {recall.map((item) => (
            <li key={item.id}>
              <p>{item.q}</p>
              {revealed[item.id] ? (
                <p>{item.a}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRevealed((prev) => ({ ...prev, [item.id]: true }));
                    progress.completeStage(slug, "recall");
                  }}
                >
                  Reveal answer
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

Wait — `createRng(Date.now() % ...)` violates no-`Date.now` discipline and determinism. Fix before writing the plan: chaos needs a seed without wall-clock. Use a counter state: `const [chaosCount, setChaosCount] = useState(0)` and seed `SEED + chaosCount`, incrementing per click. Deterministic across reloads? Counter resets per mount — acceptable: same click sequence → same fault sequence per session, and progress log records what happened. Update the island: replace `Date.now()` with counter. (Fixing inline per writing-plans self-review.)

- [ ] **Step 3: Fix the chaos seed (counter, not wall-clock)**

In `concept-lab.tsx`, add `const [chaosCount, setChaosCount] = useState(0);` and in `injectChaos` use `pickRandomFault(createRng(SEED + chaosCount * 101), ["fast", "slow"])` then `setChaosCount((c) => c + 1)`. Never `Date.now()` in UI or lib code.

- [ ] **Step 4: Build, typecheck, full suite**

Run: `pnpm install && pnpm typecheck && pnpm test && pnpm --filter web build`
Expected: PASS all; build green; M0 determinism suite still 10+ tests green (now 14 + 4 content = 18+ lib tests)

- [ ] **Step 5: Manual ship checklist (record results in commit message body)**

Load `pnpm --filter web dev` → `/concepts/load-balancing`: move RPS slider (table updates), commit prediction (error shown + localStorage `bp:load-balancing` written), chaos (note changes, table re-runs), both challenges listed, recall reveal persists after reload. Keyboard-only pass: tab through every control, state changes readable as text.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components
git commit -m "feat(web): concept lab island with predict + chaos"
```

---

## Self-Review

- Spec §Goal (four stages, predict, chaos, localStorage, no auth/DB) → Tasks 3 (content), 4 (shell+loader), 5 (island). No task missing.
- Spec predict tolerance 50ms → `DEFAULT_PREDICTION_TOLERANCE_MS` + boundary tests (Task 1).
- Spec chaos 60/40 + seeded → constants + determinism test (Task 2); wall-clock seed caught and fixed with counter (Step 3 of Task 5).
- Spec progress keys `bp:<slug>`, corrupt recovery → Task 2 tests.
- Spec word limit 600 → Task 3 test (~230 words actual).
- Type consistency: `Challenge`/`RecallItem`/`ConceptMeta` names identical Tasks 1→3→4→5; `pickRandomFault(rng, backends)` and `createProgress(store)` signatures identical Task 2→5; `LabRow` produced/consumed only in Task 5.
- No placeholders: every step has exact paths, code, commands, expected output. `pnpm --filter web build` failure in Task 4 is an expected recorded intermediate, resolved by Task 5.
- Skipped per ponytail: Worker, auth/DB/FSRS, Turborepo, Playwright, content:lint — each named in spec non-goals with its later milestone.
