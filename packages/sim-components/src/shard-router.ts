// packages/sim-components/src/shard-router.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface ShardRouterOpts {
  hashing?: "mod" | "consistent";
  virtualNodes?: number;
}

const RING_SIZE = 1_000_003;

// Deterministic FNV-1a-ish string hash (no Math.random, table-stable).
function hashStr(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % RING_SIZE;
}

export function createShardRouter(
  id: string,
  shards: string[],
  opts?: ShardRouterOpts,
): {
  handler: HandlerFn;
  metrics: () => { routed: number };
  narrate: () => string;
  ownerOf: (key: number) => string;
} {
  if (shards.length === 0) throw new Error(`shard-router '${id}': needs at least one shard`);
  // Iteration (not indexing) keeps the type string under
  // noUncheckedIndexedAccess.
  function head(): string {
    for (const shard of shards) return shard;
    throw new Error(`shard-router '${id}': empty shard list`);
  }
  const first = head();

  const hashing = opts?.hashing ?? "mod";
  if (hashing !== "mod" && hashing !== "consistent") {
    throw new Error(`shard-router '${id}': unknown hashing '${hashing}'`);
  }
  const virtualNodes = opts?.virtualNodes ?? 100;
  if (!Number.isInteger(virtualNodes) || virtualNodes <= 0) {
    throw new Error(`shard-router '${id}': virtualNodes must be a positive integer`);
  }

  // Ring sorted by position; each entry names its owning shard.
  const ring: { pos: number; shard: string }[] = [];
  if (hashing === "consistent") {
    for (const shard of shards) {
      for (let v = 0; v < virtualNodes; v += 1) {
        ring.push({ pos: hashStr(`${shard}#${v}`), shard });
      }
    }
    ring.sort((a, b) => a.pos - b.pos);
  }

  function ownerOf(key: number): string {
    if (hashing !== "consistent") return shards[key % shards.length] ?? first;
    const pos = hashStr(`key:${key}`);
    for (const entry of ring) {
      if (entry.pos >= pos) return entry.shard;
    }
    const wrap = ring[0];
    if (wrap === undefined) throw new Error(`shard-router '${id}': empty ring`);
    return wrap.shard;
  }

  let routed = 0;
  let arrivals = 0;
  const counts = new Map<string, number>();

  function keyOf(payload: unknown): number {
    if (typeof payload === "object" && payload !== null && "key" in payload) {
      const key: unknown = payload.key;
      if (typeof key === "number" && Number.isInteger(key) && key >= 0) return key;
    }
    const fallback = arrivals % Math.max(1, shards.length);
    return fallback;
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request" && event.kind !== "write") return;
    const picked = ownerOf(keyOf(event.payload));
    arrivals += 1;
    routed += 1;
    counts.set(picked, (counts.get(picked) ?? 0) + 1);
    ctx.queue.push(event.at, event.kind, picked, event.payload);
  }

  function metrics(): { routed: number } {
    return { routed };
  }

  function narrate(): string {
    const parts = shards.map((s) => `${s}=${counts.get(s) ?? 0}`).join(" ");
    return `shards: ${parts}`;
  }

  return { handler, metrics, narrate, ownerOf };
}
