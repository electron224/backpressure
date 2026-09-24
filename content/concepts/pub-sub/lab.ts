// content/concepts/pub-sub/lab.ts
export const LAB_ID = "pub-sub";

const leg = (
  queueId: string,
  svcId: string,
  drainRps: number,
): { nodes: { id: string; kind: string; config: Record<string, unknown> }[]; edges: { from: string; to: string }[] } => ({
  nodes: [
    { id: queueId, kind: "queue", config: { drainRps, maxDepth: 300, poisonEvery: 0 } },
    { id: svcId, kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
  ],
  edges: [{ from: queueId, to: svcId }],
});

const fast = leg("q-fast", "svc-fast", 200);
const medium = leg("q-medium", "svc-medium", 100);
const slow = leg("q-slow", "svc-slow", 30);

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "topic", kind: "fan-out", config: {} },
      ...fast.nodes,
      ...medium.nodes,
      ...slow.nodes,
    ],
    edges: [
      { from: "topic", to: "q-fast" },
      { from: "topic", to: "q-medium" },
      { from: "topic", to: "q-slow" },
      ...fast.edges,
      ...medium.edges,
      ...slow.edges,
    ],
  },
  controls: [{ id: "rps", label: "Publish rate (RPS)", kind: "slider", min: 20, max: 300, def: 100 }],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "ps.1", text: "Publish 100: fast and medium clean, slow leg sheds alone", verdict: "slo.p99", apply: { set: { rps: 100 } } },
  ],
};
