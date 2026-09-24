// content/concepts/observability-golden-signals/lab.ts
export const LAB_ID = "observability-golden-signals";

const svc = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 2, queueLimit: 20 },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [{ id: "lb", kind: "lb", config: {} }, svc("web-a"), svc("web-b")],
    edges: [
      { from: "lb", to: "web-a" },
      { from: "lb", to: "web-b" },
    ],
  },
  controls: [
    { id: "strategy", label: "LB strategy", kind: "select", options: ["round-robin", "least-connections"], def: "round-robin" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 60 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "ob.1", text: "Run clean at 60: all four signals green", verdict: "slo.p99", apply: { set: { rps: 60 } } },
    { id: "ob.2", text: "Inject chaos and read the four-signal story", verdict: "slo.p99", apply: { set: { rps: 60 } } },
  ],
};
