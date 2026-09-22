// content/concepts/reverse-proxy-vs-api-gateway/lab.ts
export const LAB_ID = "reverse-proxy-vs-api-gateway";

const twin = (id: string): { id: string; kind: string; config: Record<string, unknown> } => ({
  id,
  kind: "service",
  config: { serviceMs: 40, concurrency: 4, queueLimit: 50 },
});

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      twin("web-a"),
      twin("web-b"),
    ],
    edges: [
      { from: "lb", to: "web-a" },
      { from: "lb", to: "web-b" },
    ],
  },
  controls: [{ id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 }],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "proxy",
      topology: {
        nodes: [{ id: "lb", kind: "lb", config: {} }, twin("web-a"), twin("web-b")],
        edges: [
          { from: "lb", to: "web-a" },
          { from: "lb", to: "web-b" },
        ],
      },
    },
    {
      label: "gateway",
      topology: {
        nodes: [
          { id: "gw", kind: "rate-limiter", config: { algorithm: "token-bucket", rps: 120, burst: 30 } },
          { id: "lb", kind: "lb", config: {} },
          twin("web-a"),
          twin("web-b"),
        ],
        edges: [
          { from: "gw", to: "lb" },
          { from: "lb", to: "web-a" },
          { from: "lb", to: "web-b" },
        ],
      },
    },
  ],
  challenges: [
    { id: "gw.1", text: "Push 250 RPS: proxy saturates, gateway sheds and services stay clean", verdict: "slo.p99", apply: { set: { rps: 250 } }, show: "gateway" },
    { id: "gw.2", text: "Kill the gateway limiter and compare with killing one twin", verdict: "slo.p99", apply: { set: { rps: 80 } } },
  ],
};
