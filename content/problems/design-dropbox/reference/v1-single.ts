// content/problems/design-dropbox/reference/v1-single.ts
export const v1Single = {
  id: "dropbox-v1",
  topology: {
    nodes: [{ id: "db", kind: "database", config: { serviceMs: 20, lagMs: 500, keySpace: 100, mode: "async" } }],
    edges: [],
  },
  controls: [],
  metrics: ["p99"],
  challenges: [{ id: "ref.run", text: "Run the reference", verdict: "slo.p99" }],
};
