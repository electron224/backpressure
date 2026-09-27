// content/concepts/replication/lab.ts
export const LAB_ID = "replication";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "db", kind: "database", config: { serviceMs: 20, lagMs: 500, keySpace: 100 } },
    ],
    edges: [],
  },
  controls: [
    { id: "mode", label: "Replication", kind: "select", options: ["async", "sync"], def: "async" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 20 },
    { id: "db.lagMs", label: "Lag (ms)", kind: "slider", min: 0, max: 2000, def: 500 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 150, def: 120 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
};
