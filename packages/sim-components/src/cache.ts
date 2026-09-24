// packages/sim-components/src/cache.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export type WritePolicy = "aside" | "through" | "behind" | "ahead";
export type EvictionPolicy = "fifo" | "lru" | "lfu";

export interface CacheOpts {
  ttlMs: number;
  capacity: number;
  keySpace: number;
  hitMs: number;
  writePolicy?: WritePolicy;
  eviction?: EvictionPolicy;
  flushMs?: number;
  refreshMarginMs?: number;
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
  const policy = opts.writePolicy ?? "aside";
  const eviction = opts.eviction ?? "fifo";
  if (eviction !== "fifo" && eviction !== "lru" && eviction !== "lfu") {
    throw new Error(`cache '${id}': unknown eviction '${eviction}'`);
  }
  const flushMs = opts.flushMs ?? 1000;
  const refreshMarginMs = opts.refreshMarginMs ?? Math.floor(opts.ttlMs / 2);
  if (!Number.isFinite(flushMs) || flushMs <= 0) {
    throw new Error(`cache '${id}': flushMs must be a positive number`);
  }

  let hits = 0;
  let misses = 0;
  let writes = 0;
  let evictions = 0;
  let arrivals = 0;
  const entries = new Map<number, number>();
  const frequencies = new Map<number, number>();
  const dirty = new Set<number>();
  let flushDue = false;

  // Keyed arrivals (zipfian traffic) carry their key in the payload;
  // otherwise fall back to cyclic keys so legacy presets are untouched.
  function requestKey(payload: unknown): number {
    if (typeof payload === "object" && payload !== null && "key" in payload) {
      const key: unknown = payload.key;
      if (typeof key === "number" && Number.isInteger(key) && key >= 0) return key;
    }
    const key = arrivals % opts.keySpace;
    return key;
  }

  function evictOne(): void {
    if (eviction === "lfu") {
      let victim: number | undefined;
      let victimFreq = Number.POSITIVE_INFINITY;
      for (const [key] of entries) {
        const freq = frequencies.get(key) ?? 0;
        if (freq < victimFreq) {
          victimFreq = freq;
          victim = key;
        }
      }
      if (victim !== undefined) {
        entries.delete(victim);
        frequencies.delete(victim);
        evictions += 1;
      }
      return;
    }
    // fifo and lru both evict the Map-first key: insertion order for fifo,
    // recency order for lru because hits refresh position below.
    const oldest = entries.keys().next();
    if (!oldest.done) {
      entries.delete(oldest.value);
      frequencies.delete(oldest.value);
      evictions += 1;
    }
  }

  function store(key: number, now: number): void {
    entries.set(key, now + opts.ttlMs);
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    while (entries.size > opts.capacity) evictOne();
  }

  function recordHit(key: number): void {
    if (eviction === "lru") {
      const expiresAt = entries.get(key);
      if (expiresAt !== undefined) {
        entries.delete(key);
        entries.set(key, expiresAt);
      }
    }
    if (eviction === "lfu") {
      frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    }
  }

  function handleWrite(event: SimEvent, ctx: EngineContext, key: number): void {
    writes += 1;
    if (policy === "aside") {
      entries.delete(key);
      ctx.queue.push(event.at, "write", downstream, event.payload);
    } else if (policy === "through") {
      store(key, event.at);
      ctx.queue.push(event.at, "write", downstream, event.payload);
    } else if (policy === "behind") {
      store(key, event.at);
      dirty.add(key);
      // Modeled fast ack: the caller proceeds while the flush happens later.
      ctx.complete(event.at, 1, true);
      if (!flushDue) {
        flushDue = true;
        ctx.queue.push(event.at + flushMs, `flush:${id}`, id, {});
      }
    } else {
      // Refresh-ahead has no background tick in this engine (recorded
      // follow-up): a write refreshes the entry like write-through.
      store(key, event.at);
      ctx.queue.push(event.at, "write", downstream, event.payload);
    }
  }

  function handleFlush(event: SimEvent, ctx: EngineContext): void {
    flushDue = false;
    if (dirty.size === 0) return;
    // One coalesced origin write per interval, however many keys are dirty.
    ctx.queue.push(event.at, "write", downstream, { batch: dirty.size });
    dirty.clear();
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind === `flush:${id}`) {
      handleFlush(event, ctx);
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
    const expiresAt = entries.get(key);
    if (expiresAt !== undefined && expiresAt > event.at) {
      if (policy === "ahead" && expiresAt - event.at < refreshMarginMs) {
        // Synchronous revalidation stand-in: no background tick exists,
        // so a near-expiry hit refreshes inline instead of serving stale.
        misses += 1;
        store(key, event.at);
        ctx.queue.push(event.at, "request", downstream, event.payload);
        return;
      }
      recordHit(key);
      hits += 1;
      ctx.complete(event.at + opts.hitMs, opts.hitMs, true);
      return;
    }
    misses += 1;
    store(key, event.at);
    ctx.queue.push(event.at, "request", downstream, event.payload);
  }

  function metrics(): { hits: number; misses: number } {
    return { hits, misses };
  }

  function narrate(): string {
    return `cache(${opts.ttlMs}ms cap=${opts.capacity} keys=${opts.keySpace}): hits=${hits} misses=${misses} writes=${writes} dirty=${dirty.size} evict=${evictions}`;
  }

  function reset(): void {
    hits = 0;
    misses = 0;
    writes = 0;
    evictions = 0;
    arrivals = 0;
    entries.clear();
    frequencies.clear();
    dirty.clear();
    flushDue = false;
  }

  return { handler, metrics, narrate, reset };
}
