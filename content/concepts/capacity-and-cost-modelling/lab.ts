// content/concepts/capacity-and-cost-modelling/lab.ts
export const LAB_ID = "capacity-and-cost-modelling";

const thin = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 2, queueLimit: 100 },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      thin("w0"),
      thin("w1"),
      thin("w2"),
      thin("w3"),
    ],
    edges: [
      { from: "lb", to: "w0" },
      { from: "lb", to: "w1" },
      { from: "lb", to: "w2" },
      { from: "lb", to: "w3" },
    ],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 200 }],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "wide",
      topology: {
        nodes: [
          { id: "lb", kind: "lb", config: {} },
          thin("w0"),
          thin("w1"),
          thin("w2"),
          thin("w3"),
        ],
        edges: [
          { from: "lb", to: "w0" },
          { from: "lb", to: "w1" },
          { from: "lb", to: "w2" },
          { from: "lb", to: "w3" },
        ],
      },
    },
    {
      label: "tall",
      topology: {
        nodes: [{ id: "big", kind: "service", config: { serviceMs: 20, concurrency: 8, queueLimit: 200 } }],
        edges: [],
      },
    },
  ],
  challenges: [
    { id: "cc.1", text: "At 200 RPS both pass: read the cost lines and pick cheaper", verdict: "slo.p99", apply: { set: { rps: 200 } } },
  ],
};
