// content/concepts/idempotency-and-exactly-once/lab.ts
export const LAB_ID = "idempotency-and-exactly-once";

const api = {
  id: "api",
  kind: "service",
  config: { serviceMs: 20, concurrency: 4, queueLimit: 200 },
};

export const labPreset = {
  id: LAB_ID,
  topology: {
    nodes: [
      { id: "dd", kind: "dedup", config: { windowMs: 5000 } },
      api,
    ],
    edges: [{ from: "dd", to: "api" }],
  },
  controls: [
    { id: "rps", label: "Traffic (RPS)", kind: "slider", min: 20, max: 300, def: 80 },
    { id: "retryPct", label: "Retries (%)", kind: "slider", min: 0, max: 100, def: 30 },
  ],
  metrics: ["p99", "throughput", "queueDepth"],
  variants: [
    {
      label: "deduped",
      topology: {
        nodes: [
          { id: "dd", kind: "dedup", config: { windowMs: 5000 } },
          api,
        ],
        edges: [{ from: "dd", to: "api" }],
      },
    },
    {
      label: "direct",
      topology: {
        nodes: [api],
        edges: [],
      },
    },
  ],
  challenges: [
    { id: "id.1", text: "At 30% retries, dedup absorbs redeliveries without double execution", verdict: "slo.p99", apply: { set: { rps: 80, retryPct: 30 } }, show: "deduped" },
    { id: "id.2", text: "Drop retries to 0 and watch both variants converge", verdict: "slo.p99", apply: { set: { rps: 80, retryPct: 0 } } },
  ],
};
