// content/concepts/fan-out-on-write-vs-read/lab.ts
export const LAB_ID = "fan-out-on-write-vs-read";

const timeline = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 4, queueLimit: 200 },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "fan", kind: "fan-out", config: { writeOnly: true } },
      timeline("t0"),
      timeline("t1"),
      timeline("t2"),
      timeline("t3"),
    ],
    edges: [
      { from: "fan", to: "t0" },
      { from: "fan", to: "t1" },
      { from: "fan", to: "t2" },
      { from: "fan", to: "t3" },
    ],
  },
  controls: [
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "writePct", label: "Writes (%)", kind: "slider", min: 0, max: 100, def: 50 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "fw.1", text: "At 50% writes, origin load runs 4× the read path", verdict: "slo.p99", apply: { set: { rps: 80, writePct: 50 } } },
  ],
};
