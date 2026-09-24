// content/concepts/backpressure-and-dlq/lab.ts
export const LAB_ID = "backpressure-and-dlq";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "q", kind: "queue", config: { drainRps: 50, maxDepth: 200, poisonEvery: 20 } },
      { id: "worker", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [{ from: "q", to: "worker" }],
  },
  controls: [{ id: "rps", label: "Producer (RPS)", kind: "slider", min: 20, max: 300, def: 150 }],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "bp.1", text: "Flood at 150: depth explodes while poison lands in DLQ", verdict: "slo.p99", apply: { set: { rps: 150 } } },
  ],
};
