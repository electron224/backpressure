// content/concepts/load-balancing/lab.ts
export const LAB_ID = "load-balancing";

export interface LabControl {
  id: string;
  label: string;
  kind: "select" | "slider";
  options?: string[];
  min?: number;
  max?: number;
  def: string | number;
}

// Default traffic sits at 80 RPS: the fast tier (2x20ms = 100 RPS capacity)
// has headroom so least-connections passes the 150ms SLO, while
// round-robin still overloads the slow backend and blows p99 (~2s).
// Measured: RR p99=2078ms vs LC p99=146ms at seed 7 (see demo/run.ts).
const controls: LabControl[] = [
  { id: "strategy", label: "LB strategy", kind: "select", options: ["round-robin", "least-connections"], def: "round-robin" },
  { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 10, max: 300, def: 80 },
];

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: { strategy: "round-robin" } },
      { id: "fast", kind: "service", config: { serviceMs: 20, concurrency: 2, queueLimit: 50 } },
      { id: "slow", kind: "service", config: { serviceMs: 80, concurrency: 2, queueLimit: 50 } },
    ],
    edges: [
      { from: "lb", to: "fast" },
      { from: "lb", to: "slow" },
    ],
  },
  controls,
  metrics: ["p99", "throughput", "queueDepth"],
  challenges: [
    { id: "lb.1", text: "Keep p99 under 150ms at 80 RPS by switching strategy", verdict: "slo.p99", apply: { set: { strategy: "least-connections", rps: 80 } }, show: "least-connections" },
    { id: "lb.2", text: "Push to 120 RPS and report RR vs LC p99 divergence", verdict: "slo.p99", apply: { set: { rps: 120 } } },
  ],
};
