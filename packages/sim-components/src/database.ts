// packages/sim-components/src/database.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export type ReplicationMode = "async" | "sync";

export interface DatabaseOpts {
  serviceMs: number;
  lagMs: number;
  keySpace: number;
  mode: ReplicationMode;
  partitionAt?: number;
  partitionFor?: number;
}

interface ReplicaEntry {
  ver: number;
  appliedAt: number;
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
  const replica = new Map<number, ReplicaEntry>();
  const stashed: { key: number; ver: number }[] = [];

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
      const current = replica.get(pending.key);
      if (current === undefined || pending.ver > current.ver) {
        replica.set(pending.key, { ver: pending.ver, appliedAt: now });
      }
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
      // AP: ack fast, record the version for post-heal catch-up.
      writes += 1;
      const ahead = (primary.get(key) ?? 0) + 1;
      primary.set(key, ahead);
      stashed.push({ key, ver: ahead });
      ctx.complete(event.at, 1, true);
      return;
    }
    writes += 1;
    const ver = (primary.get(key) ?? 0) + 1;
    primary.set(key, ver);
    if (opts.mode === "sync") {
      replica.set(key, { ver, appliedAt: event.at });
      ctx.complete(event.at + opts.serviceMs + opts.lagMs, opts.serviceMs + opts.lagMs, true);
      return;
    }
    // Modeled fast ack: the caller proceeds while the replica applies later.
    ctx.complete(event.at, 1, true);
    ctx.queue.push(event.at + opts.lagMs, `apply:${id}`, id, { key, ver });
  }

  function handleApply(event: SimEvent): void {
    const payload: unknown = event.payload;
    if (typeof payload !== "object" || payload === null) return;
    const record = payload as { key?: unknown; ver?: unknown };
    if (typeof record.key !== "number" || typeof record.ver !== "number") return;
    // A partitioned link drops the shipment; heal() replays the stash.
    if (partitioned(event.at)) {
      stashed.push({ key: record.key, ver: record.ver });
      return;
    }
    const current = replica.get(record.key);
    if (current === undefined || record.ver > current.ver) {
      replica.set(record.key, { ver: record.ver, appliedAt: event.at });
    }
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
    const replicaVer = replica.get(key)?.ver ?? 0;
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
