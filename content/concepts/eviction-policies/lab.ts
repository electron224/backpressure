// content/concepts/eviction-policies/lab.ts
export const LAB_ID = "eviction-policies";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "edge", kind: "cache", config: { ttlMs: 60_000, capacity: 5, keySpace: 100, hitMs: 2 } },
      { id: "origin", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [{ from: "edge", to: "origin" }],
  },
  controls: [
    { id: "eviction", label: "Eviction", kind: "select", options: ["fifo", "lru", "lfu"], def: "lru" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 150, def: 120 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "ev.1", text: "At skew 120, compare hits: lru and lfu beat fifo", verdict: "slo.p99", apply: { set: { rps: 80, skewPct: 120 } } },
    { id: "ev.2", text: "Drop skew to 0 and watch the policies converge", verdict: "slo.p99", apply: { set: { rps: 80, skewPct: 0 } } },
  ],
};
