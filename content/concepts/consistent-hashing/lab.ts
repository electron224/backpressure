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
  addons: [
    {
      id: "fourth-node",
      label: "4th node",
      topology: {
        nodes: [{ id: "s3", kind: "service", config: { serviceMs: 20, concurrency: 2, queueLimit: 50 } }],
        edges: [{ from: "router", to: "s3" }],
      },
    },
  ],
};
