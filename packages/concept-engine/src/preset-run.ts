// packages/concept-engine/src/preset-run.ts
import { compile, run } from "@backpressure/sim-core";
import type { EngineContext, HandlerFn } from "@backpressure/sim-core";
import { createLoadBalancer, createCache, createDatabase, createDedup, createFanout, createPipe, createQueue, createRateLimiter, createService, createShardRouter } from "@backpressure/sim-components";
import type { LabPreset, PresetValues, Topology } from "./schema.js";

export const DEFAULT_SEED = 7;
export const DEFAULT_DURATION_MS = 5000;
export const DEFAULT_SLO_P99_MS = 150;

export interface PresetRunResult {
  p99: number;
  verdict: "PASS" | "FAIL";
  narration: string;
  rejected: number;
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
): { serviceMs: number; concurrency: number; queueLimit: number; readMs: number; writeMs: number } {
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
    readMs: numberField(base, "readMs", numberField(base, "serviceMs", 20)),
    writeMs: numberField(base, "writeMs", numberField(base, "serviceMs", 20)),
  };
}

function resolvedDbConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { serviceMs: number; lagMs: number; keySpace: number; mode: "async" | "sync"; partitionAt?: number; partitionFor?: number; replicas?: number[]; writeConcern?: "one" | "majority" | "all" } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const modeRaw: unknown = values["mode"] ?? base["mode"];
  if (modeRaw !== undefined && modeRaw !== "async" && modeRaw !== "sync") {
    throw new Error(`preset '${presetId}': unknown replication mode '${String(modeRaw)}'`);
  }
  const quorumRaw: unknown = values["quorum"] ?? base["quorum"];
  if (quorumRaw !== undefined && quorumRaw !== "one" && quorumRaw !== "majority" && quorumRaw !== "all") {
    throw new Error(`preset '${presetId}': unknown write concern '${String(quorumRaw)}'`);
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1 || key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    merged[key.slice(dot + 1)] = value;
  }
  const partitionAt = merged["partitionAt"];
  const partitionFor = merged["partitionFor"];
  if (partitionAt !== undefined && (typeof partitionAt !== "number" || partitionAt < 0)) {
    throw new Error(`preset '${presetId}': 'partitionAt' must be a non-negative number`);
  }
  if (partitionFor !== undefined && (typeof partitionFor !== "number" || partitionFor <= 0)) {
    throw new Error(`preset '${presetId}': 'partitionFor' must be a positive number`);
  }
  const mode = modeRaw === undefined ? "async" : modeRaw;
  const quorum = quorumRaw === undefined ? undefined : quorumRaw;
  const replicasRaw: unknown = base["replicas"];
  const replicas =
    Array.isArray(replicasRaw) && replicasRaw.every((r): r is number => typeof r === "number") ? replicasRaw : undefined;
  return {
    serviceMs: numberField(merged, "serviceMs", 20),
    lagMs: numberField(merged, "lagMs", 2000),
    keySpace: numberField(merged, "keySpace", 100),
    mode,
    ...(quorum === undefined ? {} : { writeConcern: quorum }),
    ...(replicas === undefined ? {} : { replicas }),
    ...(partitionAt === undefined ? {} : { partitionAt }),
    ...(partitionFor === undefined ? {} : { partitionFor }),
  };
}

function resolvedLimiterConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { algorithm: "token-bucket" | "sliding-window"; rps: number; burst: number } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const algoRaw: unknown = values["algorithm"] ?? base["algorithm"];
  if (algoRaw !== "token-bucket" && algoRaw !== "sliding-window") {
    throw new Error(`preset '${presetId}': unknown algorithm '${String(algoRaw)}'`);
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1 || key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    merged[key.slice(dot + 1)] = value;
  }
  return { algorithm: algoRaw, rps: numberField(merged, "rps", 100), burst: numberField(merged, "burst", 20) };
}

function resolvedCacheConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { ttlMs: number; capacity: number; keySpace: number; hitMs: number; writePolicy: "aside" | "through" | "behind" | "ahead"; eviction: "fifo" | "lru" | "lfu"; flushMs: number; refreshMarginMs: number } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const policyRaw: unknown = values["writePolicy"] ?? base["writePolicy"];
  if (
    policyRaw !== undefined &&
    policyRaw !== "aside" &&
    policyRaw !== "through" &&
    policyRaw !== "behind" &&
    policyRaw !== "ahead"
  ) {
    throw new Error(`preset '${presetId}': unknown write policy '${String(policyRaw)}'`);
  }
  const evictionRaw: unknown = values["eviction"] ?? base["eviction"];
  if (evictionRaw !== undefined && evictionRaw !== "fifo" && evictionRaw !== "lru" && evictionRaw !== "lfu") {
    throw new Error(`preset '${presetId}': unknown eviction '${String(evictionRaw)}'`);
  }
  if (
    policyRaw !== undefined &&
    policyRaw !== "aside" &&
    policyRaw !== "through" &&
    policyRaw !== "behind" &&
    policyRaw !== "ahead"
  ) {
    throw new Error(`preset '${presetId}': unknown write policy '${String(policyRaw)}'`);
  }
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1 || key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    base[key.slice(dot + 1)] = value;
  }
  const writePolicy = policyRaw === undefined ? "aside" : policyRaw;
  const eviction = evictionRaw === undefined ? "fifo" : evictionRaw;
  return {
    ttlMs: numberField(base, "ttlMs", 60_000),
    capacity: numberField(base, "capacity", 1000),
    keySpace: numberField(base, "keySpace", 100),
    hitMs: numberField(base, "hitMs", 2),
    writePolicy,
    eviction,
    flushMs: numberField(base, "flushMs", 1000),
    refreshMarginMs: numberField(base, "refreshMarginMs", Math.floor(numberField(base, "ttlMs", 60_000) / 2)),
  };
}

function resolvedRouterConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { hashing: "mod" | "consistent"; virtualNodes: number } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const hashingRaw: unknown = values["hashing"] ?? base["hashing"];
  if (hashingRaw !== undefined && hashingRaw !== "mod" && hashingRaw !== "consistent") {
    throw new Error(`preset '${presetId}': unknown hashing '${String(hashingRaw)}'`);
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1 || key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    merged[key.slice(dot + 1)] = value;
  }
  return {
    hashing: hashingRaw === undefined ? "mod" : hashingRaw,
    virtualNodes: numberField(merged, "virtualNodes", 100),
  };
}

function resolvedDedupConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { windowMs: number } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1 || key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    merged[key.slice(dot + 1)] = value;
  }
  return { windowMs: numberField(merged, "windowMs", 5000) };
}

function resolvedQueueConfig(
  topology: Topology,
  id: string,
  values: PresetValues,
  presetId: string,
): { drainRps: number; maxDepth: number; poisonEvery: number } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1 || key.slice(0, dot) !== id) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`preset '${presetId}': override '${key}' must be a finite number`);
    }
    merged[key.slice(dot + 1)] = value;
  }
  return {
    drainRps: numberField(merged, "drainRps", 100),
    maxDepth: numberField(merged, "maxDepth", 200),
    poisonEvery: numberField(merged, "poisonEvery", 0),
  };
}

function resolvedFanoutConfig(
  topology: Topology,
  id: string,
  presetId: string,
): { writeOnly: boolean } {
  const node = topology.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`preset '${presetId}': unknown node '${id}'`);
  const base: Record<string, unknown> = isRecord(node.config) ? { ...node.config } : {};
  const writeOnly: unknown = base["writeOnly"];
  if (writeOnly !== undefined && typeof writeOnly !== "boolean") {
    throw new Error(`preset '${presetId}': 'writeOnly' must be a boolean`);
  }
  return { writeOnly: writeOnly === true };
}

function cacheKeySpace(topology: Topology, values: PresetValues): number {
  const node = topology.nodes.find((n) => n.kind === "cache" || n.kind === "database");
  if (node === undefined) return 100;
  const override: unknown = values[`${node.id}.keySpace`];
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return Math.floor(override);
  const config: unknown = node.config;
  if (!isRecord(config)) return 100;
  return numberField(config, "keySpace", 100);
}

export function runPreset(preset: LabPreset, values: PresetValues, opts?: PresetRunOpts): PresetRunResult {
  const seed = opts?.seed ?? DEFAULT_SEED;
  const durationMs = opts?.durationMs ?? DEFAULT_DURATION_MS;
  const slo = preset.sloP99Ms ?? DEFAULT_SLO_P99_MS;
  const topology = preset.topology;

  const lbNode = topology.nodes.find((n) => n.kind === "lb");
  const routerNode = topology.nodes.find((n) => n.kind === "shard-router");
  // Database nodes are service-like terminals: they serve reads and writes
  // directly and participate in backend drop semantics.
  const serviceIds = topology.nodes
    .filter((n) => n.kind === "service" || n.kind === "database")
    .map((n) => n.id);
  const limiterNodes = topology.nodes.filter((n) => n.kind === "rate-limiter");
  const cacheNodes = topology.nodes.filter((n) => n.kind === "cache");
  const dedupNodes = topology.nodes.filter((n) => n.kind === "dedup");
  const pipeNodes = topology.nodes.filter((n) => n.kind === "pipe");
  const queueNodes = topology.nodes.filter((n) => n.kind === "queue");
  const fanoutNodes = topology.nodes.filter((n) => n.kind === "fan-out");
  const chainNodes = [...limiterNodes, ...cacheNodes, ...dedupNodes, ...pipeNodes, ...queueNodes];
  const roots = topology.nodes.filter((n) => !topology.edges.some((e) => e.to === n.id));
  if (roots.length !== 1) {
    throw new Error(`preset '${preset.id}': expected exactly 1 entry node, found ${roots.length}`);
  }
  if (
    opts?.dropBackend !== undefined &&
    (limiterNodes.some((n) => n.id === opts.dropBackend) ||
      dedupNodes.some((n) => n.id === opts.dropBackend) ||
      fanoutNodes.some((n) => n.id === opts.dropBackend) ||
      routerNode?.id === opts.dropBackend)
  ) {
    return { p99: 0, verdict: "FAIL", narration: `${preset.id}: all backends down — every request fails`, rejected: 0 };
  }
  // Dropped queues vanish like pipes: producers keep sending into the
  // void while downstream starves. Entry-point kills (limiter, dedup,
  // router) stay total outages via the rule above.
  // Dropped pipes vanish mid-chain: upstream steps complete while the rest
  // of the workflow never runs. That dangling partial completion is the
  // saga problem statement, so pipes stay out of the all-down rule.
  const deadPipes = new Set(
    pipeNodes.filter((n) => n.id === opts?.dropBackend).map((n) => n.id),
  );
  // Dropped cache = cold restart, which matches the fresh-run state:
  // ignore the drop and run normally.
  const effectiveDrop =
    opts?.dropBackend !== undefined && cacheNodes.some((n) => n.id === opts.dropBackend)
      ? undefined
      : opts?.dropBackend;
  const chainTargets = new Map<string, string>();
  for (const chain of chainNodes) {
    const targets = topology.edges.filter((e) => e.from === chain.id).map((e) => e.to);
    if (targets.length !== 1 || targets[0] === undefined) {
      throw new Error(`chain node '${chain.id}': needs exactly 1 downstream target`);
    }
    chainTargets.set(chain.id, targets[0]);
  }
  // Exactly one distributor (lb, router, or fan-out broadcast) per preset.
  const distributors = [lbNode, routerNode, ...fanoutNodes].filter((n) => n !== undefined);
  if (distributors.length > 1) {
    throw new Error(`preset '${preset.id}': at most 1 distributor supported`);
  }
  const distributor = distributors[0];
  let backends = distributor
    ? topology.edges.filter((e) => e.from === distributor.id).map((e) => e.to)
    : [...serviceIds];
  if (effectiveDrop !== undefined) {
    backends = backends.filter((b) => b !== effectiveDrop);
  }
  if (backends.length === 0) {
    return { p99: 0, verdict: "FAIL", narration: `${preset.id}: all backends down — every request fails`, rejected: 0 };
  }
  if (!distributor && backends.length > 1) {
    throw new Error(`preset '${preset.id}': multiple services without a distributor are unsupported`);
  }

  const rpsRaw: unknown = values["rps"];
  if (typeof rpsRaw !== "number" || !Number.isFinite(rpsRaw) || rpsRaw <= 0) {
    throw new Error(`preset '${preset.id}': 'rps' must be a positive number`);
  }
  const writePctRaw: unknown = values["writePct"] ?? 0;
  if (typeof writePctRaw !== "number" || !Number.isFinite(writePctRaw) || writePctRaw < 0 || writePctRaw > 100) {
    throw new Error(`preset '${preset.id}': 'writePct' must be between 0 and 100`);
  }
  const retryPctRaw: unknown = values["retryPct"] ?? 0;
  if (typeof retryPctRaw !== "number" || !Number.isFinite(retryPctRaw) || retryPctRaw < 0 || retryPctRaw > 100) {
    throw new Error(`preset '${preset.id}': 'retryPct' must be between 0 and 100`);
  }
  // Skewed keys are opt-in (skewPct slider): without it traffic stays
  // unkeyed and legacy presets are byte-identical.
  const skewRaw: unknown = values["skewPct"];
  const keyAlpha = skewRaw === undefined ? undefined : Number(skewRaw) / 100;
  if (keyAlpha !== undefined && (!Number.isFinite(keyAlpha) || keyAlpha < 0 || keyAlpha > 2)) {
    throw new Error(`preset '${preset.id}': 'skewPct' must be between 0 and 200`);
  }

  const nodeKind = (nid: string): string => topology.nodes.find((n) => n.id === nid)?.kind ?? "service";
  // The sim graph mirrors the full topology minus a dropped backend, so
  // services behind queues and chain steps all resolve handlers.
  const removedNode = effectiveDrop;
  const graph = compile({
    nodes: topology.nodes
      .filter((n) => n.id !== removedNode)
      .map((n) => ({ id: n.id, kind: n.kind, config: {} })),
    edges: topology.edges
      .filter((e) => e.from !== removedNode && e.to !== removedNode)
      .map((e) => ({ from: e.from, to: e.to })),
  });
  const router = routerNode ? createShardRouter(routerNode.id, backends, resolvedRouterConfig(topology, routerNode.id, values, preset.id)) : null;
  const fanoutNode = fanoutNodes[0];
  const fanout = fanoutNode ? createFanout(fanoutNode.id, backends, resolvedFanoutConfig(topology, fanoutNode.id, preset.id)) : null;
  const queueIds = [...new Set([...queueNodes.map((n) => n.id), ...backends.filter((b) => nodeKind(b) === "queue")])];
  const queues = new Map(
    queueIds.map((id) => {
      const downstream = chainTargets.get(id);
      if (downstream === undefined) throw new Error(`queue '${id}': missing downstream`);
      return [id, createQueue(id, resolvedQueueConfig(topology, id, values, preset.id), downstream)];
    }),
  );
  const services = new Map(
    topology.nodes
      .filter((n) => n.kind === "service" && n.id !== removedNode)
      .map((n) => [n.id, createService(n.id, resolvedServiceConfig(topology, n.id, values, preset.id))]),
  );
  const databases = new Map(
    topology.nodes
      .filter((n) => n.kind === "database" && n.id !== removedNode)
      .map((b) => [b.id, createDatabase(b.id, resolvedDbConfig(topology, b.id, values, preset.id))]),
  );
  const pipes = new Map(
    pipeNodes.map((n) => {
      const downstream = chainTargets.get(n.id);
      if (downstream === undefined) throw new Error(`pipe '${n.id}': missing downstream`);
      return [n.id, createPipe(n.id, downstream)];
    }),
  );
  const limiters = new Map(
    limiterNodes.map((n) => {
      const downstream = chainTargets.get(n.id);
      if (downstream === undefined) throw new Error(`rate-limiter '${n.id}': missing downstream`);
      return [n.id, createRateLimiter(n.id, resolvedLimiterConfig(topology, n.id, values, preset.id), downstream)];
    }),
  );
  const dedups = new Map(
    dedupNodes.map((n) => {
      const downstream = chainTargets.get(n.id);
      if (downstream === undefined) throw new Error(`dedup '${n.id}': missing downstream`);
      return [n.id, createDedup(n.id, resolvedDedupConfig(topology, n.id, values, preset.id), downstream)];
    }),
  );
  const caches = new Map(
    cacheNodes.map((n) => {
      const downstream = chainTargets.get(n.id);
      if (downstream === undefined) throw new Error(`cache '${n.id}': missing downstream`);
      return [n.id, createCache(n.id, resolvedCacheConfig(topology, n.id, values, preset.id), downstream)];
    }),
  );

  const strategyRaw: unknown = values["strategy"];
  const strategy = strategyRaw === "least-connections" || strategyRaw === "sticky" ? strategyRaw : "round-robin";

  // Breaker is opt-in per preset (values["breaker"] === "on"): existing
  // presets without the control keep legacy numbers byte-identically.
  const breakerOn = values["breaker"] === "on";
  const lb = lbNode
    ? createLoadBalancer({
        strategy: strategy === "least-connections" ? "least-connections" : "round-robin",
        backends,
        ...(breakerOn ? { breaker: { failureThreshold: 3, cooldownMs: 2000 } } : {}),
      })
    : null;

  const handlers = new Map<string, HandlerFn>();
  if (routerNode && router !== null) {
    handlers.set(routerNode.id, router.handler);
  }
  if (fanoutNode && fanout !== null) {
    handlers.set(fanoutNode.id, fanout.handler);
  }
  if (lbNode) {
    if (strategy === "sticky") {
      const pinned = backends[0];
      if (pinned === undefined) throw new Error(`preset '${preset.id}': empty backend list`);
      handlers.set(lbNode.id, (event, ctx) => {
        if (event.kind !== "request") return;
        ctx.queue.push(event.at, "request", pinned, { arrival: event.at });
      });
    } else {
      if (lb === null) throw new Error(`preset '${preset.id}': missing load balancer`);
      const balancer = lb;
      handlers.set(lbNode.id, (event, ctx) => {
        if (event.kind !== "request") return;
        const target = balancer.pick(
          (id) => {
            const m = services.get(id)?.metrics();
            return (m?.inflight ?? 0) + (m?.queueDepth ?? 0);
          },
          event.at,
        );
        ctx.queue.push(event.at, "request", target, { arrival: event.at });
      });
    }
  }
  // Report service outcomes back to the balancer so an enabled breaker
  // observes failures. The wrapper delegates everything else untouched.
  for (const [id, svc] of services) {
    // Only LB-routed backends report: services behind queues have no
    // breaker entry and would throw unknown-backend.
    if (lb !== null && breakerOn && backends.includes(id)) {
      const balancer = lb;
      handlers.set(id, (event, ctx) => {
        const reporting: EngineContext = {
          ...ctx,
          complete: (at, latencyMs, ok) => {
            balancer.recordResult(id, ok, at);
            ctx.complete(at, latencyMs, ok);
          },
        };
        svc.handler(event, reporting);
      });
    } else {
      handlers.set(id, svc.handler);
    }
  }
  for (const [id, lim] of limiters) handlers.set(id, lim.handler);
  for (const [id, pipe] of pipes) {
    if (!deadPipes.has(id)) handlers.set(id, pipe.handler);
  }
  for (const [id, dedup] of dedups) handlers.set(id, dedup.handler);
  for (const [id, cache] of caches) handlers.set(id, cache.handler);
  for (const [id, queue] of queues) handlers.set(id, queue.handler);
  for (const [id, db] of databases) handlers.set(id, db.handler);

  const result = run({
    seed,
    graph,
    traffic: {
      rps: rpsRaw,
      durationMs,
      writeRatio: writePctRaw / 100,
      retryRatio: retryPctRaw / 100,
      ...(keyAlpha === undefined ? {} : { keyAlpha, keySpace: cacheKeySpace(topology, values) }),
    },
    handlers,
    sloP99Ms: slo,
  });
  const p99 = result.verdicts.find((v) => v.id === "slo.p99")?.observed ?? 0;
  const passed = result.verdicts.some((v) => v.id === "slo.p99" && v.passed);
  const rejected = result.metrics.reduce((sum, point) => sum + point.errors, 0);
  const origin = lb !== null ? lb.narrate() : router !== null ? router.narrate() : fanout !== null ? fanout.narrate() : "direct";
  const narration = [
    origin,
    ...[...queues.values()].map((q) => q.narrate()),
    ...[...limiters.values()].map((l) => l.narrate()),
    ...[...pipes.values()].map((p) => p.narrate()),
    ...[...dedups.values()].map((d) => d.narrate()),
    ...[...caches.values()].map((c) => c.narrate()),
    ...[...services.values()].map((s) => s.narrate()),
    ...[...databases.values()].map((d) => d.narrate()),
  ].join(" | ");
  return { p99, verdict: passed ? "PASS" : "FAIL", narration, rejected };
}
