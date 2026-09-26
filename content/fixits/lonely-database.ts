// content/fixits/lonely-database.ts — one node holds everything.
export const lonelyDatabase = {
  id: "lonely-database",
  title: "Lonely database",
  concept: "single-point-of-failure",
  story:
    "One database, no replica, no cache. It passes while healthy and vanishes the moment it is not. Give it company and a shield until killing any single node changes nothing.",
  start: {
    nodes: [{ id: "db", kind: "database", config: {} }],
    edges: [],
  },
  rps: 80,
  killSurvive: true,
};
