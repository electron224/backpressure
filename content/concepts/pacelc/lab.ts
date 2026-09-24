// content/concepts/pacelc/lab.ts
export const LAB_ID = "pacelc";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "db", kind: "database", config: { serviceMs: 20, lagMs: 2000, keySpace: 100 } },
    ],
    edges: [],
  },
  controls: [
    { id: "mode", label: "Choice: async is latency, sync is consistency", kind: "select", options: ["async", "sync"], def: "async" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 20 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 150, def: 120 },
    { id: "db.lagMs", label: "Replica lag (ms)", kind: "slider", min: 0, max: 2000, def: 500 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "pace.1", text: "No partition, lag 2000: sync pays it on every write", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "sync", "db.lagMs": 2000 } }, show: "sync" },
    { id: "pace.2", text: "Same setup async: fast writes, staleness climbs with lag", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "async", "db.lagMs": 2000 } }, show: "async" },
  ],
};
