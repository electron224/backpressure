// content/problems/design-twitter/reference/v1-naive.ts
export const v1Naive = {
  id: "twitter-v1",
  topology: {
    nodes: [
      { id: "fan", kind: "fan-out", config: { writeOnly: true } },
      { id: "timeline", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 100 } },
    ],
    edges: [{ from: "fan", to: "timeline" }],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
