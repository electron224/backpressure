// content/problems/design-url-shortener/reference/v1-single.ts
export const v1Single = {
  id: "url-shortener-v1",
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      { id: "api", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 100 } },
    ],
    edges: [{ from: "lb", to: "api" }],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
