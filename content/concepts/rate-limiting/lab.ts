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
};
