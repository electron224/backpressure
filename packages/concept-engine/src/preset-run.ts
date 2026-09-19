// packages/concept-engine/src/preset-run.ts
import { compile, run } from "@backpressure/sim-core";
import type { HandlerFn } from "@backpressure/sim-core";
import { createLoadBalancer, createService } from "@backpressure/sim-components";
import type { LabPreset, PresetValues, Topology } from "./schema.js";

export const DEFAULT_SEED = 7;
export const DEFAULT_DURATION_MS = 5000;
export const DEFAULT_SLO_P99_MS = 150;

export interface PresetRunResult {
  p99: number;
  verdict: "PASS" | "FAIL";
  narration: string;
}

export interface PresetRunOpts {
  seed?: number;
  durationMs?: number;
  dropBackend?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberField(config: Record<string, unknown>, key: string, fallback: number): number {
  const value: unknown = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolvedServiceConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { serviceMs: number; concurrency: number; queueLimit: number } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1) continue;
    if (key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    base[key.slice(dot + 1)] = value;
  }
  return {
    serviceMs: numberField(base, "serviceMs", 20),
    concurrency: numberField(base, "concurrency", 2),
    queueLimit: numberField(base, "queueLimit", 50),
  };
}

export function runPreset(preset: LabPreset, values: PresetValues, opts?: PresetRunOpts): PresetRunResult {
  const seed = opts?.seed ?? DEFAULT_SEED;
  const durationMs = opts?.durationMs ?? DEFAULT_DURATION_MS;
  const slo = preset.sloP99Ms ?? DEFAULT_SLO_P99_MS;
  const topology = preset.topology;

  const lbNode = topology.nodes.find((n) => n.kind === "lb");
  const serviceIds = topology.nodes.filter((n) => n.kind === "service").map((n) => n.id);
  let backends = lbNode
    ? topology.edges.filter((e) => e.from === lbNode.id).map((e) => e.to)
    : [...serviceIds];
  if (opts?.dropBackend !== undefined) {
    backends = backends.filter((b) => b !== opts.dropBackend);
  }
  if (backends.length === 0) {
    return { p99: 0, verdict: "FAIL", narration: `${preset.id}: all backends down — every request fails` };
  }
  if (!lbNode && backends.length > 1) {
    throw new Error(`preset '${preset.id}': multiple services without an lb node are unsupported`);
  }

  const rpsRaw: unknown = values["rps"];
  if (typeof rpsRaw !== "number" || !Number.isFinite(rpsRaw) || rpsRaw <= 0) {
    throw new Error(`preset '${preset.id}': 'rps' must be a positive number`);
  }

  const graph = compile({
    nodes: [
      ...(lbNode ? [{ id: lbNode.id, kind: "lb", config: {} }] : []),
      ...backends.map((b) => ({ id: b, kind: "service", config: {} })),
    ],
    edges: lbNode ? backends.map((b) => ({ from: lbNode.id, to: b })) : [],
  });
  const services = new Map(
    backends.map((b) => [b, createService(b, resolvedServiceConfig(topology, b, values, preset.id))]),
  );

  // No strategy control on presets like SPOF (lb node, no strategy value):
  // default a missing/invalid strategy to round-robin. Twins are identical
  // there, so RR is correct; LB presets set strategy explicitly via control.
  const strategyRaw: unknown = values["strategy"];
  const strategy = strategyRaw === "least-connections" || strategyRaw === "sticky" ? strategyRaw : "round-robin";

  const handlers = new Map<string, HandlerFn>();
  if (lbNode) {
    if (strategy === "sticky") {
      const pinned = backends[0];
      if (pinned === undefined) throw new Error(`preset '${preset.id}': empty backend list`);
      handlers.set(lbNode.id, (event, ctx) => {
        if (event.kind !== "request") return;
        ctx.queue.push(event.at, "request", pinned, { arrival: event.at });
      });
    } else {
      const lb = createLoadBalancer({
        strategy: strategy === "least-connections" ? "least-connections" : "round-robin",
        backends,
      });
      handlers.set(lbNode.id, (event, ctx) => {
        if (event.kind !== "request") return;
        const target = lb.pick((id) => {
          const m = services.get(id)?.metrics();
          return (m?.inflight ?? 0) + (m?.queueDepth ?? 0);
        });
        ctx.queue.push(event.at, "request", target, { arrival: event.at });
      });
    }
  }
  for (const [id, svc] of services) handlers.set(id, svc.handler);

  const result = run({ seed, graph, traffic: { rps: rpsRaw, durationMs }, handlers, sloP99Ms: slo });
  const p99 = result.verdicts.find((v) => v.id === "slo.p99")?.observed ?? 0;
  const passed = result.verdicts.some((v) => v.id === "slo.p99" && v.passed);
  const origin = lbNode ? `lb: backends=[${backends.join(",")}]` : "direct";
  const narration = [origin, ...[...services.values()].map((s) => s.narrate())].join(" | ");
  return { p99, verdict: passed ? "PASS" : "FAIL", narration };
}
