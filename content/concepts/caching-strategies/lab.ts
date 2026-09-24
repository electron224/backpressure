// content/concepts/caching-strategies/lab.ts
export const LAB_ID = "caching-strategies";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "cache", kind: "cache", config: { ttlMs: 60_000, capacity: 1000, keySpace: 100, hitMs: 2 } },
      { id: "db", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [{ from: "cache", to: "db" }],
  },
  controls: [
    { id: "writePolicy", label: "Write policy", kind: "select", options: ["aside", "through", "behind", "ahead"], def: "aside" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 20 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "cs.1", text: "At 20% writes, compare write latency: behind vs through", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20 } } },
    { id: "cs.2", text: "Push writes to 50%: which policies keep p99 under 150ms", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 50 } } },
  ],
};
