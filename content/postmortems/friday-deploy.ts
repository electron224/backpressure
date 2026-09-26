// content/postmortems friday-deploy.ts — cache stampede after a config push.
export const fridayDeploy = {
  id: "friday-deploy",
  title: "Friday deploy: p99 cliff at 18:04",
  brief:
    "After a config push lowered edge TTL, p99 jumped past a second while the origin saturated. Traffic barely moved. Alerts: p99 SLO breach, origin queue depth critical.",
  preset: {
    id: "postmortem-cdn",
    topology: {
      nodes: [
        { id: "edge", kind: "cache", config: { ttlMs: 60_000, capacity: 1000, keySpace: 100, hitMs: 2 } },
        { id: "origin", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 200 } },
      ],
      edges: [{ from: "edge", to: "origin" }],
    },
    controls: [],
    metrics: ["p99"],
    challenges: [{ id: "pm.run", text: "Reproduce", verdict: "slo.p99" }],
  },
  values: { rps: 220, "edge.ttlMs": 1000, "edge.keySpace": 10_000 },
  diagnoses: [
    { id: "d1", text: "Origin underprovisioned for the traffic" },
    { id: "d2", text: "TTL below the revisit cycle over a wide key space" },
    { id: "d3", text: "A traffic spike overwhelmed a healthy cache" },
  ],
  answerId: "d2",
  fix: {
    values: { rps: 220, "edge.ttlMs": 60_000, "edge.keySpace": 100 },
    explanation: "Restore TTL above the revisit cycle and narrow the working set: hits return, origin drains.",
  },
};
