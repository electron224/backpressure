// packages/concept-engine/tests/preset-run.test.ts
import { describe, expect, it } from "vitest";
import { labPreset } from "../../../content/concepts/load-balancing/lab.js";
import { LabPresetSchema } from "../src/schema.js";
import { runPreset } from "../src/preset-run.js";

function lbValues(strategy: string, rps: number): Record<string, string | number> {
  return { strategy, rps };
}

describe("runPreset LB parity (seed 7, 80 RPS)", () => {
  it("round-robin fails the 150ms SLO near 2078ms", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, lbValues("round-robin", 80));
    expect(result.verdict).toBe("FAIL");
    expect(result.p99).toBeGreaterThan(1000);
  });

  it("least-connections passes near 146ms", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, lbValues("least-connections", 80));
    expect(result.verdict).toBe("PASS");
    expect(result.p99).toBeLessThan(150);
  });

  // Binding ruling (Task 4 gap fix): a missing/invalid strategy defaults to
  // round-robin when an lb node exists, so presets without a strategy
  // control (e.g. SPOF replicated) run instead of throwing.
  it("defaults an unknown strategy to round-robin", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, lbValues("magic-hash", 80));
    expect(result.verdict).toBe("FAIL");
    expect(result.p99).toBeGreaterThan(1000);
  });

  it("defaults a missing strategy to round-robin", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, { rps: 80 });
    const rr = runPreset(preset, lbValues("round-robin", 80));
    expect(result.verdict).toBe("FAIL");
    expect(result.p99).toBe(rr.p99);
  });

  it("sticky pins the first backend", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, lbValues("sticky", 80));
    expect(result.narration).toContain("fast: served=400");
  });

  it("nodeId.field overrides service config", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const slow = runPreset(preset, { strategy: "least-connections", rps: 80, "fast.serviceMs": 200 });
    expect(slow.p99).toBeGreaterThan(150);
  });

  it("dropping the last backend fails with narration, not a crash", () => {
    const preset = LabPresetSchema.parse({
      id: "spof-single",
      topology: {
        nodes: [{ id: "web", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } }],
        edges: [],
      },
      controls: [],
      metrics: ["p99"],
      challenges: [{ id: "s1", text: "Survive", verdict: "slo.p99" }],
    });
    const before = runPreset(preset, { rps: 80 });
    expect(before.verdict).toBe("PASS");
    const after = runPreset(preset, { rps: 80 }, { dropBackend: "web" });
    expect(after.verdict).toBe("FAIL");
    expect(after.narration).toContain("all backends down");
  });
});

const limiterChain = {
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

describe("rate-limiter chain (limiter -> service, no lb)", () => {
  it("sheds at 150 RPS with service drops at 0", () => {
    const preset = LabPresetSchema.parse(limiterChain);
    const result = runPreset(preset, { rps: 150 });
    expect(result.rejected).toBeGreaterThan(0);
    expect(result.narration).toContain("dropped=0");
  });

  it("admits everything at 80 RPS", () => {
    const preset = LabPresetSchema.parse(limiterChain);
    const result = runPreset(preset, { rps: 80 });
    expect(result.rejected).toBe(0);
  });

  it("kill on limiter fails all-down, not crash", () => {
    const preset = LabPresetSchema.parse(limiterChain);
    const result = runPreset(preset, { rps: 80 }, { dropBackend: "lim" });
    expect(result.verdict).toBe("FAIL");
    expect(result.narration).toContain("all backends down");
  });

  it("unknown algorithm throws", () => {
    const bad = LabPresetSchema.parse({
      ...limiterChain,
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
      ...limiterChain,
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

  it("multiple entry nodes throw", () => {
    const multi = LabPresetSchema.parse({
      ...limiterChain,
      topology: {
        nodes: [
          { id: "a", kind: "service", config: {} },
          { id: "b", kind: "service", config: {} },
        ],
        edges: [],
      },
    });
    expect(() => runPreset(multi, { rps: 80 })).toThrow(/exactly 1 entry/i);
  });
});

const cacheChain = {
  id: "cdn",
  topology: {
    nodes: [
      { id: "edge", kind: "cache", config: { ttlMs: 60_000, capacity: 1000, keySpace: 100, hitMs: 2 } },
      { id: "origin", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [{ from: "edge", to: "origin" }],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "c1", text: "Shield", verdict: "slo.p99" }],
} as const;

describe("cache chain (edge -> origin, no lb)", () => {
  it("holds 220 RPS while direct origin collapses", () => {
    const preset = LabPresetSchema.parse(cacheChain);
    const shielded = runPreset(preset, { rps: 220 });
    expect(shielded.verdict).toBe("PASS");
    expect(shielded.narration).toContain("dropped=0");
    const direct = LabPresetSchema.parse({
      ...cacheChain,
      topology: {
        nodes: [{ id: "origin", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } }],
        edges: [],
      },
    });
    const exposed = runPreset(direct, { rps: 220 });
    expect(exposed.verdict).toBe("FAIL");
    expect(exposed.p99).toBeGreaterThan(shielded.p99 * 2);
  });

  it("collapses to origin saturation at TTL 1s", () => {
    const preset = LabPresetSchema.parse(cacheChain);
    const result = runPreset(preset, { rps: 300, "edge.ttlMs": 1000 });
    expect(result.verdict).toBe("FAIL");
  });

  it("kill on cache runs on cold (same as fresh), not crash", () => {
    const preset = LabPresetSchema.parse(cacheChain);
    const fresh = runPreset(preset, { rps: 80 });
    const killed = runPreset(preset, { rps: 80 }, { dropBackend: "edge" });
    expect(killed.verdict).toBe(fresh.verdict);
    expect(killed.p99).toBe(fresh.p99);
  });
});

const hbChain = {
  id: "hb",
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      { id: "fast", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 50 } },
      { id: "flaky", kind: "service", config: { serviceMs: 150, concurrency: 1, queueLimit: 0 } },
    ],
    edges: [
      { from: "lb", to: "fast" },
      { from: "lb", to: "flaky" },
    ],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "h1", text: "Eject", verdict: "slo.p99" }],
} as const;

describe("breaker opt-in", () => {
  it("ejects the flaky backend and sheds less than without", () => {
    const preset = LabPresetSchema.parse(hbChain);
    const on = runPreset(preset, { strategy: "round-robin", rps: 150, breaker: "on" });
    const off = runPreset(preset, { strategy: "round-robin", rps: 150, breaker: "off" });
    // Ejection is proven behaviorally: with the breaker the flaky backend
    // stops receiving traffic after 3 consecutive failures, so total
    // rejects collapse while p99 holds. (End-state narration can't pin it:
    // flapping half-open trials correctly re-close the circuit.)
    expect(off.rejected).toBeGreaterThan(on.rejected * 2);
    expect(on.verdict).toBe("PASS");
  });

  it("stays off without the opt-in (legacy numbers)", () => {
    const preset = LabPresetSchema.parse(hbChain);
    const result = runPreset(preset, { strategy: "round-robin", rps: 150 });
    expect(result.narration).toContain("open=[]");
  });
});

describe("write traffic mix (writePct)", () => {
  it("completes writes through the chain without loss", () => {
    const preset = LabPresetSchema.parse(cacheChain);
    const result = runPreset(preset, { rps: 80, writePct: 20 });
    expect(result.narration).toContain("writes=");
    const writes = Number(result.narration.split("writes=")[1]?.split(" ")[0] ?? "NaN");
    expect(writes).toBeGreaterThan(0);
  });

  it("rejects out-of-range writePct", () => {
    const preset = LabPresetSchema.parse(cacheChain);
    expect(() => runPreset(preset, { rps: 80, writePct: 101 })).toThrow(/writePct/i);
    expect(() => runPreset(preset, { rps: 80, writePct: -1 })).toThrow(/writePct/i);
  });
});

const dbChain = {
  id: "repl",
  topology: {
    nodes: [{ id: "db", kind: "database", config: { serviceMs: 20, lagMs: 500, keySpace: 100 } }],
    edges: [],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "d1", text: "Lag", verdict: "slo.p99" }],
} as const;

describe("database wiring", () => {
  it("async serves stale, sync stays clean with slower writes", () => {
    const preset = LabPresetSchema.parse(dbChain);
    const lagged = { ...preset, topology: preset.topology };
    const asyncRun = runPreset(lagged, { rps: 80, writePct: 20, skewPct: 120, mode: "async" });
    const syncRun = runPreset(lagged, { rps: 80, writePct: 20, skewPct: 120, mode: "sync" });
    expect(asyncRun.narration).toMatch(/stale=[1-9]/);
    expect(syncRun.narration).toContain("stale=0");
    expect(syncRun.p99).toBeGreaterThan(asyncRun.p99);
  });

  it("kill on database fails all-down", () => {
    const preset = LabPresetSchema.parse(dbChain);
    const result = runPreset(preset, { rps: 80 }, { dropBackend: "db" });
    expect(result.verdict).toBe("FAIL");
    expect(result.narration).toContain("all backends down");
  });

  it("unknown mode throws", () => {
    const preset = LabPresetSchema.parse(dbChain);
    expect(() => runPreset(preset, { rps: 80, mode: "eventual-ish" })).toThrow(/unknown replication mode/i);
  });
});

const shardChain = {
  id: "sh",
  topology: {
    nodes: [
      { id: "router", kind: "shard-router", config: {} },
      { id: "s0", kind: "service", config: { serviceMs: 20, concurrency: 2, queueLimit: 50 } },
      { id: "s1", kind: "service", config: { serviceMs: 20, concurrency: 2, queueLimit: 50 } },
    ],
    edges: [
      { from: "router", to: "s0" },
      { from: "router", to: "s1" },
    ],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "s1", text: "Shard", verdict: "slo.p99" }],
} as const;

describe("shard-router distributor", () => {
  it("routes by key and stays clean unskewed", () => {
    const preset = LabPresetSchema.parse(shardChain);
    const result = runPreset(preset, { rps: 80 });
    expect(result.verdict).toBe("PASS");
    expect(result.narration).toContain("shards:");
  });

  it("kill on router fails all-down", () => {
    const preset = LabPresetSchema.parse(shardChain);
    const result = runPreset(preset, { rps: 80 }, { dropBackend: "router" });
    expect(result.verdict).toBe("FAIL");
    expect(result.narration).toContain("all backends down");
  });
});

const dedupChain = {
  id: "idem",
  topology: {
    nodes: [
      { id: "dd", kind: "dedup", config: { windowMs: 5000 } },
      { id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [{ from: "dd", to: "api" }],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "i1", text: "Dedup", verdict: "slo.p99" }],
} as const;

describe("dedup chain", () => {
  it("absorbs retries without double execution", () => {
    const preset = LabPresetSchema.parse(dedupChain);
    const plain = runPreset(preset, { rps: 80, retryPct: 0 });
    const storm = runPreset(preset, { rps: 80, retryPct: 30 });
    expect(storm.narration).toContain("duplicates=");
    expect(plain.narration).toContain("duplicates=0");
    const servedOf = (narr: string): number => {
      const match = narr.match(/api: served=(\d+)/);
      return Number(match?.[1] ?? "NaN");
    };
    expect(servedOf(storm.narration)).toBeLessThan(servedOf(plain.narration) * 1.1);
  });

  it("kill on dedup fails all-down", () => {
    const preset = LabPresetSchema.parse(dedupChain);
    const result = runPreset(preset, { rps: 80 }, { dropBackend: "dd" });
    expect(result.verdict).toBe("FAIL");
    expect(result.narration).toContain("all backends down");
  });
});


describe("request traces", () => {
  it("exposes per-request completions consistent with buckets", () => {
    const preset = LabPresetSchema.parse(labPreset);
    const result = runPreset(preset, { strategy: "least-connections", rps: 80 });
    expect(result.completions.length).toBeGreaterThan(0);
    expect(result.completions.length).toBeLessThanOrEqual(2000);
    const ok = result.completions.filter((c) => c.ok).length;
    const errors = result.completions.length - ok;
    expect(errors).toBe(result.rejected);
    expect(ok).toBeGreaterThan(0);
    for (const c of result.completions) {
      expect(c.at).toBeGreaterThanOrEqual(0);
      expect(c.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
