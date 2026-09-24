// content/concepts/cap-theorem/lab.ts
export const LAB_ID = "cap-theorem";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      {
        id: "db",
        kind: "database",
        config: { serviceMs: 20, lagMs: 500, keySpace: 100, partitionAt: 2000, partitionFor: 2000 },
      },
    ],
    edges: [],
  },
  controls: [
    { id: "mode", label: "Side: async is AP, sync is CP", kind: "select", options: ["async", "sync"], def: "async" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 20 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 150, def: 120 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "cap.1", text: "Partition with AP: reads keep flowing, staleness climbs, then heals", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "async" } }, show: "async" },
    { id: "cap.2", text: "Partition with CP: zero stale, fast errors instead", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "sync" } }, show: "sync" },
  ],
};
