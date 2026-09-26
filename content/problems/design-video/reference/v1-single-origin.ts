// content/problems/design-video/reference/v1-single-origin.ts
export const v1SingleOrigin = {
  id: "video-v1",
  topology: {
    nodes: [{ id: "origin", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 100 } }],
    edges: [],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
