// content/concepts/statelessness/lab.ts
export const LAB_ID = "statelessness";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      { id: "srv-a", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } },
      { id: "srv-b", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } },
    ],
    edges: [
      { from: "lb", to: "srv-a" },
      { from: "lb", to: "srv-b" },
    ],
  },
  controls: [
    { id: "strategy", label: "Routing strategy", kind: "select", options: ["sticky", "least-connections"], def: "least-connections" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 10, max: 200, def: 80 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    {
      id: "sls.1",
      text: "Push to 120 RPS: sticky saturates one backend while least-connections holds",
      verdict: "slo.p99",
      apply: { set: { rps: 120 } },
      show: "least-connections",
    },
  ],
};
