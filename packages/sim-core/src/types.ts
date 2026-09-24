// packages/sim-core/src/types.ts
export interface TopologyNode {
  id: string;
  kind: string;
  config: Record<string, unknown>;
}

export interface TopologyEdge {
  from: string;
  to: string;
}

export interface Topology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface SimGraph {
  nodes: Map<string, TopologyNode>;
  downstream: Map<string, string[]>;
  order: string[];
}

export interface TrafficProfile {
  rps: number;
  durationMs: number;
  keyAlpha?: number;
  writeRatio?: number;
}

export type FaultKind = "kill-node" | "traffic-spike";

export interface ScenarioEvent {
  at: number;
  fault: FaultKind;
  targets?: string[];
  rps?: number;
}

export interface SimEvent {
  at: number;
  seq: number;
  kind: string;
  targetId: string;
  payload?: unknown;
}

export interface MetricPoint {
  t: number;
  p50: number;
  p99: number;
  throughput: number;
  errors: number;
  trace: string;
}

export interface Verdict {
  id: string;
  passed: boolean;
  observed: number;
  threshold: number;
  explanation: string;
}

export interface Rng {
  next(): number;
  nextInt(bound: number): number;
  nextExponential(meanMs: number): number;
}
