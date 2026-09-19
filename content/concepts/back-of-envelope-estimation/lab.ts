// content/concepts/back-of-envelope-estimation/lab.ts
export const LAB_ID = "back-of-envelope-estimation";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [{ id: "web", kind: "service", config: { serviceMs: 20, concurrency: 5, queueLimit: 50 } }],
    edges: [],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 10, max: 500, def: 100 }],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    {
      id: "est.1",
      text: "Predict p99 at 100 RPS, then reveal — expect it well under the 150ms SLO",
      verdict: "slo.p99",
      apply: { set: { rps: 100 } },
    },
    {
      id: "est.2",
      text: "Predict p99 at 240 RPS (near the 250 RPS capacity), then reveal",
      verdict: "slo.p99",
      apply: { set: { rps: 240 } },
    },
  ],
};
