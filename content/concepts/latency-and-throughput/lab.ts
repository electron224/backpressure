// content/concepts/latency-and-throughput/lab.ts
export const LAB_ID = "latency-and-throughput";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [{ id: "web", kind: "service", config: { serviceMs: 50, concurrency: 2, queueLimit: 100 } }],
    edges: [],
  },
  controls: [
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 10, max: 200, def: 80 },
    { id: "web.serviceMs", label: "Service time (ms)", kind: "slider", min: 10, max: 200, def: 50 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "lat.1", text: "Find the RPS where p99 first exceeds 150ms", verdict: "slo.p99", apply: { set: { rps: 40 } } },
  ],
};
