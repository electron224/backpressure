// content/concepts/cdn/lab.ts
export const LAB_ID = "cdn";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "edge", kind: "cache", config: { ttlMs: 60_000, capacity: 1000, keySpace: 100, hitMs: 2 } },
      { id: "origin", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
    ],
    edges: [{ from: "edge", to: "origin" }],
  },
  controls: [
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "edge.ttlMs", label: "Edge TTL (ms)", kind: "slider", min: 1000, max: 120_000, def: 60_000 },
    { id: "edge.keySpace", label: "Key space", kind: "slider", min: 10, max: 10_000, def: 100 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "direct",
      topology: {
        nodes: [{ id: "origin", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } }],
        edges: [],
      },
    },
    { label: "edge" },
  ],
  challenges: [
    { id: "cdn.1", text: "Push 220 RPS: direct origin collapses, cached edge holds", verdict: "slo.p99", apply: { set: { rps: 220 } }, show: "edge" },
    { id: "cdn.2", text: "Drop TTL to 1s over 10k keys at 220 RPS and watch the shield collapse", verdict: "slo.p99", apply: { set: { rps: 220, "edge.ttlMs": 1000, "edge.keySpace": 10_000 } }, show: "edge" },
  ],
};
