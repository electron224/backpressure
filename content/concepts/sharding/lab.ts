// content/concepts/sharding/lab.ts
export const LAB_ID = "sharding";

const shard = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 2, queueLimit: 50 },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [{ id: "router", kind: "shard-router", config: {} }, shard("s0"), shard("s1"), shard("s2"), shard("s3")],
    edges: [
      { from: "router", to: "s0" },
      { from: "router", to: "s1" },
      { from: "router", to: "s2" },
      { from: "router", to: "s3" },
    ],
  },
  controls: [
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 150 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 200, def: 150 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "sh.1", text: "Skew 150 at 200 RPS: shard 0 saturates while siblings idle", verdict: "slo.p99", apply: { set: { rps: 200, skewPct: 150 } } },
    { id: "sh.2", text: "Drop skew to 0 and watch the shards balance", verdict: "slo.p99", apply: { set: { rps: 200, skewPct: 0 } } },
  ],
};
