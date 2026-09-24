// content/concepts/cdc-and-outbox/lab.ts
export const LAB_ID = "cdc-and-outbox";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "fan", kind: "fan-out", config: {} },
      { id: "ledger", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
      { id: "relay", kind: "queue", config: { drainRps: 200, maxDepth: 500, poisonEvery: 0 } },
      { id: "sink", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [
      { from: "fan", to: "ledger" },
      { from: "fan", to: "relay" },
      { from: "relay", to: "sink" },
    ],
  },
  controls: [
    { id: "rps", label: "Write traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 100 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "cdc.1", text: "Kill the relay leg: ledger holds what the sink never sees", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 100 } } },
  ],
};
