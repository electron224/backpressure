// content/problems/design-dropbox/reference/v2-replicated.ts
export const v2Replicated = {
  id: "dropbox-v2",
  topology: {
    nodes: [
      { id: "edge", kind: "cache", config: { ttlMs: 60_000, capacity: 2000, keySpace: 200, hitMs: 2 } },
      { id: "lb", kind: "lb", config: {} },
      { id: "db-a", kind: "database", config: { serviceMs: 20, lagMs: 500, keySpace: 200, mode: "async" } },
      { id: "db-b", kind: "database", config: { serviceMs: 20, lagMs: 500, keySpace: 200, mode: "async" } },
    ],
    edges: [
      { from: "edge", to: "lb" },
      { from: "lb", to: "db-a" },
      { from: "lb", to: "db-b" },
    ],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
