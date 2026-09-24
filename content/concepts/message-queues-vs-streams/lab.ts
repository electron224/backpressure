// content/concepts/message-queues-vs-streams/lab.ts
export const LAB_ID = "message-queues-vs-streams";

const svc = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 4, queueLimit: 50 },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "q", kind: "queue", config: { drainRps: 150, maxDepth: 600, poisonEvery: 0 } },
      svc("api"),
    ],
    edges: [{ from: "q", to: "api" }],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 150 }],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "direct",
      topology: { nodes: [svc("api")], edges: [] },
    },
    { label: "queued" },
  ],
  challenges: [
    { id: "mq.1", text: "Burst 250: direct sheds, queue holds and drains late", verdict: "slo.p99", apply: { set: { rps: 250 } } },
  ],
};
