// content/concepts/single-point-of-failure/lab.ts
export const LAB_ID = "single-point-of-failure";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [{ id: "web", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } }],
    edges: [],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 10, max: 200, def: 80 }],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "single",
      topology: {
        nodes: [{ id: "web", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } }],
        edges: [],
      },
    },
    {
      label: "replicated",
      topology: {
        nodes: [
          { id: "lb", kind: "lb", config: {} },
          { id: "web-a", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } },
          { id: "web-b", kind: "service", config: { serviceMs: 40, concurrency: 4, queueLimit: 50 } },
        ],
        edges: [
          { from: "lb", to: "web-a" },
          { from: "lb", to: "web-b" },
        ],
      },
    },
  ],
  challenges: [
    { id: "spof.1", text: "Survive a kill-node fault with zero errors", verdict: "slo.p99", apply: { set: { rps: 80 } }, show: "replicated" },
  ],
};
