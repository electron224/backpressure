// packages/canvas/src/compiler.ts
import type { Topology, TopologyNode } from "@backpressure/concept-engine";

export interface FlowNode {
  id: string;
  kind: string;
  config: Record<string, unknown>;
}

export interface FlowEdge {
  from: string;
  to: string;
}

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  lb: {},
  service: { serviceMs: 20, concurrency: 4, queueLimit: 50 },
  "rate-limiter": { algorithm: "token-bucket", rps: 100, burst: 20 },
  cache: { ttlMs: 60_000, capacity: 1000, keySpace: 100, hitMs: 2 },
  database: { serviceMs: 20, lagMs: 500, keySpace: 100, mode: "async" },
  "shard-router": {},
  dedup: { windowMs: 5000 },
  pipe: {},
  queue: { drainRps: 100, maxDepth: 200, poisonEvery: 0 },
  "fan-out": {},
};

export function paletteKinds(): string[] {
  return Object.keys(DEFAULT_CONFIGS);
}

const KNOWN_KINDS: TopologyNode["kind"][] = [
  "lb",
  "service",
  "rate-limiter",
  "cache",
  "database",
  "shard-router",
  "dedup",
  "pipe",
  "queue",
  "fan-out",
];

function toKind(kind: string): TopologyNode["kind"] {
  const found = KNOWN_KINDS.find((known) => known === kind);
  if (found === undefined) {
    throw new Error(`unknown node kind '${kind}' (palette: ${paletteKinds().join(", ")})`);
  }
  return found;
}

export function compileFlow(nodes: FlowNode[], edges: FlowEdge[]): Topology {
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.id)) throw new Error(`duplicate node id: ${node.id}`);
    seen.add(node.id);
    toKind(node.kind);
  }
  for (const edge of edges) {
    if (!seen.has(edge.from)) throw new Error(`unknown edge source: ${edge.from}`);
    if (!seen.has(edge.to)) throw new Error(`unknown edge target: ${edge.to}`);
  }
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: toKind(node.kind),
      config: { ...DEFAULT_CONFIGS[node.kind], ...node.config },
    })),
    edges: edges.map((edge) => ({ from: edge.from, to: edge.to })),
  };
}
