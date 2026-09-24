// content/concepts/consistent-hashing/lab.ts
export const LAB_ID = "consistent-hashing";

const shard = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 2, queueLimit: 50 },
});

const three = [
  { from: "router", to: "s0" },
  { from: "router", to: "s1" },
  { from: "router", to: "s2" },
];

const four = [...three, { from: "router", to: "s3" }];

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [{ id: "router", kind: "shard-router", config: { hashing: "consistent", virtualNodes: 100 } }, shard("s0"), shard("s1"), shard("s2")],
    edges: three,
  },
  controls: [
    { id: "hashing", label: "Hashing", kind: "select", options: ["mod", "consistent"], def: "consistent" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 150 },
    { id: "skewPct", label: "Skew (alpha ×100)", kind: "slider", min: 0, max: 200, def: 120 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "3 nodes",
      topology: {
        nodes: [{ id: "router", kind: "shard-router", config: { hashing: "consistent", virtualNodes: 100 } }, shard("s0"), shard("s1"), shard("s2")],
        edges: three,
      },
    },
    {
      label: "4 nodes",
      topology: {
        nodes: [{ id: "router", kind: "shard-router", config: { hashing: "consistent", virtualNodes: 100 } }, shard("s0"), shard("s1"), shard("s2"), shard("s3")],
        edges: four,
      },
    },
  ],
  challenges: [
    { id: "ch.1", text: "Add the 4th node: mod reshuffles most keys, ring keeps ~3/4 stable", verdict: "slo.p99", apply: { set: { rps: 150, skewPct: 120 } } },
    { id: "ch.2", text: "Compare per-shard spread: mod vs consistent at skew 120", verdict: "slo.p99", apply: { set: { rps: 150, skewPct: 120 } } },
  ],
};
