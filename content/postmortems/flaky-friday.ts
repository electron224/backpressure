// content/postmortems flaky-friday.ts — undetected sick backend without breaker.
export const flakyFriday = {
  id: "flaky-friday",
  title: "Flaky Friday: error budget gone by noon",
  brief:
    "Errors climbed to double digits while p99 held near the SLO. No deploy, no traffic change. One backend logs timeouts; the balancer keeps feeding it its full share.",
  preset: {
    id: "postmortem-hb",
    topology: {
      nodes: [
        { id: "lb", kind: "lb", config: {} },
        { id: "fast", kind: "service", config: { serviceMs: 20, concurrency: 4, queueLimit: 50 } },
        { id: "flaky", kind: "service", config: { serviceMs: 150, concurrency: 1, queueLimit: 0 } },
      ],
      edges: [
        { from: "lb", to: "fast" },
        { from: "lb", to: "flaky" },
      ],
    },
    controls: [],
    metrics: ["p99"],
    challenges: [{ id: "pm.run", text: "Reproduce", verdict: "slo.p99" }],
  },
  values: { rps: 150, breaker: "off" },
  diagnoses: [
    { id: "d1", text: "Not enough total capacity for the load" },
    { id: "d2", text: "Balancer feeding a sick backend with no ejection" },
    { id: "d3", text: "SLO threshold set too tight for normal variance" },
  ],
  answerId: "d2",
  fix: {
    values: { rps: 150, breaker: "on" },
    explanation: "Enable the breaker: three consecutive failures eject flaky, errors collapse, p99 holds.",
  },
};
