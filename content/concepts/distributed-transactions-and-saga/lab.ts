// content/concepts/distributed-transactions-and-saga/lab.ts
export const LAB_ID = "distributed-transactions-and-saga";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "order", kind: "pipe", config: {} },
      { id: "pay", kind: "pipe", config: {} },
      { id: "ship", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [
      { from: "order", to: "pay" },
      { from: "pay", to: "ship" },
    ],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 }],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "sg.1", text: "Kill the pay step: order completes, nothing ships", verdict: "slo.p99", apply: { set: { rps: 80 } } },
    { id: "sg.2", text: "Full chain at 80: every order ships clean", verdict: "slo.p99", apply: { set: { rps: 80 } } },
  ],
};
