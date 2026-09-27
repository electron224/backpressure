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
};
