// content/problems/design-video/reference/v2-cdn.ts
export const v2Cdn = {
  id: "video-v2",
  topology: {
    nodes: [
      { id: "edge", kind: "cache", config: { ttlMs: 300_000, capacity: 5000, keySpace: 200, hitMs: 2 } },
      { id: "lb", kind: "lb", config: {} },
      { id: "origin-a", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 100 } },
      { id: "origin-b", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 100 } },
    ],
    edges: [
      { from: "edge", to: "lb" },
      { from: "lb", to: "origin-a" },
      { from: "lb", to: "origin-b" },
    ],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
