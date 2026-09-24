// content/concepts/sql-vs-nosql/lab.ts
export const LAB_ID = "sql-vs-nosql";

const store = (id: string, readMs: number, writeMs: number): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 8, queueLimit: 200, readMs, writeMs },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [store("sql", 15, 45)],
    edges: [],
  },
  controls: [
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 50 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "sql",
      topology: { nodes: [store("sql", 15, 45)], edges: [] },
    },
    {
      label: "nosql",
      topology: { nodes: [{ id: "nosql", kind: "service", config: { serviceMs: 20, concurrency: 8, queueLimit: 200, readMs: 10, writeMs: 10 } }], edges: [] },
    },
  ],
  challenges: [
    { id: "sn.1", text: "At 50% writes, compare p99: constraint checks compound", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 50 } } },
    { id: "sn.2", text: "Drop writes to 0% and watch the gap narrow to reads only", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 0 } } },
  ],
};
