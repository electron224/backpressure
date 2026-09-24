// content/concepts/graceful-degradation-and-bulkheads/lab.ts
export const LAB_ID = "graceful-degradation-and-bulkheads";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lim", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 150, burst: 30 } },
      { id: "lb", kind: "lb", config: {} },
      { id: "fast", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 50 } },
      { id: "flaky", kind: "service", config: { serviceMs: 150, concurrency: 1, queueLimit: 0 } },
    ],
    edges: [
      { from: "lim", to: "lb" },
      { from: "lb", to: "fast" },
      { from: "lb", to: "flaky" },
    ],
  },
  controls: [
    { id: "breaker", label: "Circuit breaker", kind: "select", options: ["on", "off"], def: "on" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 150 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "gd.1", text: "Kill flaky at 150: degraded serving, survivor clean", verdict: "slo.p99", apply: { set: { rps: 150, breaker: "on" } } },
  ],
};
