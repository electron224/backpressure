// content/concepts/health-checks-and-circuit-breakers/lab.ts
export const LAB_ID = "health-checks-and-circuit-breakers";

export const labPreset = {
  id: LAB_ID,
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
  controls: [
    { id: "breaker", label: "Circuit breaker", kind: "select", options: ["on", "off"], def: "on" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 150 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "hb.1", text: "Hold 150 RPS with errors collapsed and p99 held", verdict: "slo.p99", apply: { set: { rps: 150, breaker: "on" } }, show: "on" },
    { id: "hb.2", text: "Flip the breaker off at 150 RPS and compare rejected totals", verdict: "slo.p99", apply: { set: { rps: 150 } } },
  ],
};
