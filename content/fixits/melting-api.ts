// content/fixits/melting-api.ts — single origin melting at 250 RPS.
export const meltingApi = {
  id: "melting-api",
  title: "Melting API",
  concept: "caching-strategies",
  story:
    "This API serves everything straight from one origin. At 250 RPS it saturates and sheds. Add whatever the palette offers — cache, replicas, limits — until the same traffic passes.",
  start: {
    nodes: [{ id: "api", kind: "service", config: {} }],
    edges: [],
  },
  rps: 250,
};
