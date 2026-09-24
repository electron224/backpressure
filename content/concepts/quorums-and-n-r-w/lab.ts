// content/concepts/quorums-and-n-r-w/lab.ts
export const LAB_ID = "quorums-and-n-r-w";

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      {
        id: "db",
        kind: "database",
        config: { serviceMs: 20, lagMs: 500, keySpace: 100, mode: "sync", replicas: [100, 500, 2000] },
      },
    ],
    edges: [],
  },
  controls: [
    { id: "quorum", label: "Write concern", kind: "select", options: ["one", "majority", "all"], def: "majority" },
    { id: "mode", label: "Mode", kind: "select", options: ["async", "sync"], def: "sync" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 20 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 150, def: 120 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "q.1", text: "Sync writes: latency follows the quorum tier", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "sync" } } },
    { id: "q.2", text: "Async reads spread over replicas go stale on slow ones", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 20, mode: "async" } } },
  ],
};
