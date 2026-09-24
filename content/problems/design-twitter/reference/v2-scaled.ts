// content/problems/design-twitter/reference/v2-scaled.ts
export const v2Scaled = {
  id: "twitter-v2",
  topology: {
    nodes: [
      { id: "lim", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 500, burst: 50 } },
      { id: "edge", kind: "cache", config: { ttlMs: 60_000, capacity: 5000, keySpace: 500, hitMs: 2 } },
      { id: "fan", kind: "fan-out", config: { writeOnly: true } },
      { id: "lb", kind: "lb", config: {} },
      { id: "api-a", kind: "service", config: { serviceMs: 15, concurrency: 4, queueLimit: 100 } },
      { id: "api-b", kind: "service", config: { serviceMs: 15, concurrency: 4, queueLimit: 100 } },
    ],
    edges: [
      { from: "lim", to: "edge" },
      { from: "edge", to: "fan" },
      { from: "fan", to: "lb" },
      { from: "lb", to: "api-a" },
      { from: "lb", to: "api-b" },
    ],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
