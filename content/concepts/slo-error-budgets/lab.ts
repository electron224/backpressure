// content/concepts/slo-error-budgets/lab.ts
export const LAB_ID = "slo-error-budgets";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lim", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 100, burst: 20 } },
      { id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [{ from: "lim", to: "api" }],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 150 }],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "slo.1", text: "Hold 150 against a 100 limit: watch the budget burn", verdict: "slo.p99", apply: { set: { rps: 150 } } },
    { id: "slo.2", text: "Back to 90: errors stop, budget recovers", verdict: "slo.p99", apply: { set: { rps: 90 } } },
  ],
};
