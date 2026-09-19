// content/concepts/vertical-vs-horizontal-scaling/lab.ts
export const LAB_ID = "vertical-vs-horizontal-scaling";

const fatTopology = {
  nodes: [{ id: "big", kind: "service", config: { serviceMs: 25, concurrency: 8, queueLimit: 100 } }],
  edges: [],
};

const wideTopology = {
  nodes: [
    { id: "lb", kind: "lb", config: {} },
    { id: "web-1", kind: "service", config: { serviceMs: 25, concurrency: 2, queueLimit: 100 } },
    { id: "web-2", kind: "service", config: { serviceMs: 25, concurrency: 2, queueLimit: 100 } },
    { id: "web-3", kind: "service", config: { serviceMs: 25, concurrency: 2, queueLimit: 100 } },
    { id: "web-4", kind: "service", config: { serviceMs: 25, concurrency: 2, queueLimit: 100 } },
  ],
  edges: [
    { from: "lb", to: "web-1" },
    { from: "lb", to: "web-2" },
    { from: "lb", to: "web-3" },
    { from: "lb", to: "web-4" },
  ],
};

export const labPreset = {
  id: LAB_ID,
  topology: fatTopology,
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 10, max: 400, def: 200 }],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    { label: "fat", topology: fatTopology },
    { label: "wide", topology: wideTopology },
  ],
  challenges: [
    {
      id: "scale.1",
      text: "Both pass at 200 RPS — push to 300 and compare degradation",
      verdict: "slo.p99",
      apply: { set: { rps: 300 } },
    },
  ],
};
