// content/concepts/indexing/lab.ts
export const LAB_ID = "indexing";

const table = (id: string, readMs: number, writeMs: number): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 8, queueLimit: 200, readMs, writeMs },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [table("indexed", 5, 30)],
    edges: [],
  },
  controls: [
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 5 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "indexed",
      topology: { nodes: [table("indexed", 5, 30)], edges: [] },
    },
    {
      label: "heap",
      topology: { nodes: [{ id: "heap", kind: "service", config: { serviceMs: 20, concurrency: 8, queueLimit: 200, readMs: 150, writeMs: 10 } }], edges: [] },
    },
  ],
  challenges: [
    { id: "ix.1", text: "Read-heavy at 5% writes: indexed answers in single digits", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 5 } } },
    { id: "ix.2", text: "Push 150 RPS read-heavy: heap saturates past capacity, indexed holds", verdict: "slo.p99", apply: { set: { rps: 150, writePct: 5 } } },
  ],
};
