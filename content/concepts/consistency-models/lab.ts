// content/concepts/consistency-models/lab.ts
export const LAB_ID = "consistency-models";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "db", kind: "database", config: { serviceMs: 20, lagMs: 500, keySpace: 100 } },
    ],
    edges: [],
  },
  controls: [
    { id: "mode", label: "Model: sync is strong, async is eventual", kind: "select", options: ["async", "sync"], def: "async" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 20 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 150, def: 120 },
    { id: "db.lagMs", label: "Replica lag (ms)", kind: "slider", min: 0, max: 2000, def: 500 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "cm.1", text: "Lag 500 async: staleness appears, concentrated on hot keys", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "async" } }, show: "async" },
    { id: "cm.2", text: "Lag 0: strong consistency, zero stale at no extra cost", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "async", "db.lagMs": 0 } }, show: "async" },
  ],
};
