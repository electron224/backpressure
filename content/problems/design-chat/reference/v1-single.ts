// content/problems/design-chat/reference/v1-single.ts
export const v1Single = {
  id: "chat-v1",
  topology: {
    nodes: [{ id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 100 } }],
    edges: [],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
