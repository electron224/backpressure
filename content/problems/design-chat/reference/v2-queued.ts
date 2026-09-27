// content/problems/design-chat/reference/v2-queued.ts
export const v2Queued = {
  id: "chat-v2",
  topology: {
    nodes: [
      { id: "inbox", kind: "queue", config: { drainRps: 200, maxDepth: 500, poisonEvery: 0 } },
      { id: "lb", kind: "lb", config: {} },
      { id: "api-a", kind: "service", config: { serviceMs: 15, concurrency: 4, queueLimit: 100 } },
      { id: "api-b", kind: "service", config: { serviceMs: 15, concurrency: 4, queueLimit: 100 } },
    ],
    edges: [
      { from: "inbox", to: "lb" },
      { from: "lb", to: "api-a" },
      { from: "lb", to: "api-b" },
    ],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
