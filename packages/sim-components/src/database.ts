// packages/sim-components/src/database.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export type ReplicationMode = "async" | "sync";
export type WriteConcern = "one" | "majority" | "all";

export interface DatabaseOpts {
  serviceMs: number;
  lagMs: number;
  keySpace: number;
  mode: ReplicationMode;
  partitionAt?: number;
  partitionFor?: number;
  replicas?: number[];
  writeConcern?: WriteConcern;
}

export function createDatabase(
  id: string,
  opts: DatabaseOpts,
): {
  handler: HandlerFn;
  metrics: () => { reads: number; writes: number; stale: number };
  narrate: () => string;
} {
  if (!Number.isFinite(opts.serviceMs) || opts.serviceMs <= 0) {
    throw new Error(`database '${id}': serviceMs must be a positive number`);
  }
  if (!Number.isFinite(opts.lagMs) || opts.lagMs < 0) {
    throw new Error(`database '${id}': lagMs must be a non-negative number`);
  }
  if (!Number.isInteger(opts.keySpace) || opts.keySpace <= 0) {
    throw new Error(`database '${id}': keySpace must be a positive integer`);
  }

  let reads = 0;
  let writes = 0;
  let stale = 0;
  let arrivals = 0;
  const primary = new Map<number, number>();
  // Per-key version per replica index; lags[i] is replica i's delay.
  const replicaVers = new Map<number, number[]>();
  const lags: number[] =
    opts.replicas !== undefined && opts.replicas.length > 0 ? [...opts.replicas] : [opts.lagMs];
  for (const lag of lags) {
    if (!Number.isFinite(lag) || lag < 0) throw new Error(`database '${id}': replica lags must be non-negative numbers`);
  }
  const sortedLags = [...lags].sort((a, b) => a - b);
  const concern = opts.writeConcern ?? (opts.mode === "sync" ? "all" : "one");
  if (concern !== "one" && concern !== "majority" && concern !== "all") {
    throw new Error(`database '${id}': unknown write concern '${concern}'`);
  }
  const quorumCount = concern === "one" ? 1 : concern === "all" ? sortedLags.length : Math.floor(sortedLags.length / 2) + 1;
  const quorumLag = sortedLags[quorumCount - 1] ?? opts.lagMs;
  const stashed: { key: number; ver: number; replica: number }[] = [];

  function partitioned(now: number): boolean {
    return (
      opts.partitionAt !== undefined &&
      opts.partitionFor !== undefined &&
      now >= opts.partitionAt &&
      now < opts.partitionAt + opts.partitionFor
    );
  }

  // Delayed applies land when the link heals; stashed ones flush first.
  function heal(now: number): void {
    if (stashed.length === 0) return;
    if (partitioned(now)) return;
    for (const pending of stashed.splice(0, stashed.length)) {
      const versions = replicaVers.get(pending.key) ?? [];
      while (versions.length < lags.length) versions.push(0);
      if (pending.ver > (versions[pending.replica] ?? 0)) versions[pending.replica] = pending.ver;
      replicaVers.set(pending.key, versions);
    }
  }

  function applyVersion(key: number, ver: number, replica: number): void {
    const versions = replicaVers.get(key) ?? [];
    while (versions.length < lags.length) versions.push(0);
    if (ver > (versions[replica] ?? 0)) {
      versions[replica] = ver;
      replicaVers.set(key, versions);
    }
  }

  function requestKey(payload: unknown): number {
    if (typeof payload === "object" && payload !== null && "key" in payload) {
      const key: unknown = payload.key;
      if (typeof key === "number" && Number.isInteger(key) && key >= 0) return key;
    }
    return arrivals % opts.keySpace;
  }

  function handleWrite(event: SimEvent, ctx: EngineContext, key: number): void {
    heal(event.at);
    if (partitioned(event.at)) {
      if (opts.mode === "sync") {
        // CP: no replica ack possible — reject before touching primary.
        ctx.complete(event.at, 1, false);
        return;
      }
      // AP: ack fast, record the version on every replica for catch-up.
      writes += 1;
      const ahead = (primary.get(key) ?? 0) + 1;
      primary.set(key, ahead);
      for (let replica = 0; replica < lags.length; replica += 1) {
        stashed.push({ key, ver: ahead, replica });
      }
      ctx.complete(event.at, 1, true);
      return;
    }
    writes += 1;
    const ver = (primary.get(key) ?? 0) + 1;
    primary.set(key, ver);
    if (opts.mode === "sync") {
      // Quorum ack: the W-th fastest replica decides write latency.
      // All replicas converge at ack time (conservative: never stale).
      for (let replica = 0; replica < lags.length; replica += 1) {
        applyVersion(key, ver, replica);
      }
      const costMs = opts.serviceMs + quorumLag;
      ctx.complete(event.at + costMs, costMs, true);
      return;
    }
    // Modeled fast ack: the caller proceeds while replicas apply later.
    ctx.complete(event.at, 1, true);
    lags.forEach((lag, replica) => {
      ctx.queue.push(event.at + lag, `apply:${id}`, id, { key, ver, replica });
    });
  }

  function handleApply(event: SimEvent): void {
    const payload: unknown = event.payload;
    if (typeof payload !== "object" || payload === null) return;
    const record = payload as { key?: unknown; ver?: unknown; replica?: unknown };
    if (typeof record.key !== "number" || typeof record.ver !== "number") return;
    const replica = typeof record.replica === "number" ? record.replica : 0;
    // A partitioned link drops the shipment; heal() replays the stash.
    if (partitioned(event.at)) {
      stashed.push({ key: record.key, ver: record.ver, replica });
      return;
    }
    applyVersion(record.key, record.ver, replica);
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind === `apply:${id}`) {
      handleApply(event);
      return;
    }
    if (event.kind === "write") {
      const key = requestKey(event.payload);
      arrivals += 1;
      handleWrite(event, ctx, key);
      return;
    }
    if (event.kind !== "request") return;
    const key = requestKey(event.payload);
    arrivals += 1;
    heal(event.at);
    reads += 1;
    if (partitioned(event.at) && opts.mode === "sync") {
      // CP: minority side refuses reads rather than risk staleness.
      ctx.complete(event.at, 1, false);
      return;
    }
    const primaryVer = primary.get(key) ?? 0;
    // Reads land on a random replica (seeded RNG: deterministic per seed).
    const replicaIdx = lags.length === 1 ? 0 : Math.floor(ctx.rng.next() * lags.length);
    const replicaVer = replicaVers.get(key)?.[replicaIdx] ?? 0;
    if (replicaVer < primaryVer) stale += 1;
    ctx.complete(event.at + opts.serviceMs, opts.serviceMs, true);
  }

  function metrics(): { reads: number; writes: number; stale: number } {
    return { reads, writes, stale };
  }

  function narrate(): string {
    return `db(${opts.mode} lag=${opts.lagMs}ms): reads=${reads} writes=${writes} stale=${stale}`;
  }

  return { handler, metrics, narrate };
}
