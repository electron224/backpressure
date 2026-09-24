// content/concepts/leader-election-intuition/lab.ts
export const LAB_ID = "leader-election-intuition";

const twin = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 20, concurrency: 4, queueLimit: 100 },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [{ id: "lb", kind: "lb", config: {} }, twin("leader"), twin("follower")],
    edges: [
      { from: "lb", to: "leader" },
      { from: "lb", to: "follower" },
    ],
  },
  controls: [
    { id: "strategy", label: "Routing", kind: "select", options: ["sticky", "least-connections"], def: "sticky" },
    { id: "breaker", label: "Circuit breaker", kind: "select", options: ["on", "off"], def: "on" },
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "le.1", text: "Sticky pins the leader while the follower idles by design", verdict: "slo.p99", apply: { set: { rps: 80 } } },
    { id: "le.2", text: "Kill the leader: the pin re-seats with zero config change", verdict: "slo.p99", apply: { set: { rps: 80 } } },
  ],
};
