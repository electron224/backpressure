// packages/sim-components/src/cache.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface CacheOpts {
  ttlMs: number;
  capacity: number;
  keySpace: number;
  hitMs: number;
}

export function createCache(
  id: string,
  opts: CacheOpts,
  downstream: string,
): {
  handler: HandlerFn;
  metrics: () => { hits: number; misses: number };
  narrate: () => string;
  reset: () => void;
} {
  if (!Number.isFinite(opts.ttlMs) || opts.ttlMs <= 0) {
    throw new Error(`cache '${id}': ttlMs must be a positive number`);
  }
  if (!Number.isInteger(opts.capacity) || opts.capacity <= 0) {
    throw new Error(`cache '${id}': capacity must be a positive integer`);
  }
  if (!Number.isInteger(opts.keySpace) || opts.keySpace <= 0) {
    throw new Error(`cache '${id}': keySpace must be a positive integer`);
  }
  if (!Number.isFinite(opts.hitMs) || opts.hitMs < 0) {
    throw new Error(`cache '${id}': hitMs must be a non-negative number`);
  }
  if (downstream.length === 0) throw new Error(`cache '${id}': missing downstream`);

  let hits = 0;
  let misses = 0;
  let arrivals = 0;
  const entries = new Map<number, number>();

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request") return;
    const key = arrivals % opts.keySpace;
    arrivals += 1;
    const expiresAt = entries.get(key);
    if (expiresAt !== undefined && expiresAt > event.at) {
      hits += 1;
      ctx.complete(event.at + opts.hitMs, opts.hitMs, true);
      return;
    }
    misses += 1;
    entries.set(key, event.at + opts.ttlMs);
    if (entries.size > opts.capacity) {
      const oldest = entries.keys().next();
      if (!oldest.done) entries.delete(oldest.value);
    }
    ctx.queue.push(event.at, "request", downstream, event.payload);
  }

  function metrics(): { hits: number; misses: number } {
    return { hits, misses };
  }

  function narrate(): string {
    return `cache(${opts.ttlMs}ms cap=${opts.capacity} keys=${opts.keySpace}): hits=${hits} misses=${misses}`;
  }

  function reset(): void {
    hits = 0;
    misses = 0;
    arrivals = 0;
    entries.clear();
  }

  return { handler, metrics, narrate, reset };
}
