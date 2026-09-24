// packages/sim-components/src/shard-router.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export function createShardRouter(
  id: string,
  shards: string[],
): { handler: HandlerFn; metrics: () => { routed: number }; narrate: () => string } {
  if (shards.length === 0) throw new Error(`shard-router '${id}': needs at least one shard`);
  // Iteration (not indexing) keeps the type string under
  // noUncheckedIndexedAccess.
  function head(): string {
    for (const shard of shards) return shard;
    throw new Error(`shard-router '${id}': empty shard list`);
  }
  const first = head();

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
    const picked = shards[keyOf(event.payload) % shards.length] ?? first;
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

  return { handler, metrics, narrate };
}
