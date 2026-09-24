// content/concepts/deployment-strategies/lab.ts
export const LAB_ID = "deployment-strategies";

const version = (id: string, serviceMs: number, concurrency: number, queueLimit: number): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs, concurrency, queueLimit },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: { weights: [{ id: "v1", weight: 9 }, { id: "v2", weight: 1 }] } },
      version("v1", 20, 4, 200),
      version("v2", 500, 1, 0),
    ],
    edges: [
      { from: "lb", to: "v1" },
      { from: "lb", to: "v2" },
    ],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 100 }],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "canary",
      topology: {
        nodes: [
          { id: "lb", kind: "lb", config: { weights: [{ id: "v1", weight: 9 }, { id: "v2", weight: 1 }] } },
          version("v1", 20, 4, 200),
          version("v2", 500, 1, 0),
        ],
        edges: [
          { from: "lb", to: "v1" },
          { from: "lb", to: "v2" },
        ],
      },
    },
    {
      label: "cutover",
      topology: {
        nodes: [version("v2", 500, 1, 0)],
        edges: [],
      },
    },
  ],
  challenges: [
    { id: "dp.1", text: "Canary at 100: errors hold near a tenth", verdict: "slo.p99", apply: { set: { rps: 100 } } },
    { id: "dp.2", text: "Full cutover to faulty v2: everything fails", verdict: "slo.p99", apply: { set: { rps: 100 } } },
  ],
};
