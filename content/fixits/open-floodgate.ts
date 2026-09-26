// content/fixits/open-floodgate.ts — unprotected service under overload.
export const openFloodgate = {
  id: "open-floodgate",
  title: "Open floodgate",
  concept: "rate-limiting",
  story:
    "No admission control: every spike lands directly on a small service. Put something in front that sheds excess before the service drowns — then push 300 RPS through it.",
  start: {
    nodes: [{ id: "api", kind: "service", config: {} }],
    edges: [],
  },
  rps: 300,
};
