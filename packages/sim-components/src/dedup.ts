// packages/sim-components/src/dedup.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface DedupOpts {
  windowMs: number;
}

export function createDedup(
  id: string,
  opts: DedupOpts,
  downstream: string,
): {
  handler: HandlerFn;
  metrics: () => { fresh: number; duplicates: number };
  narrate: () => string;
} {
  if (!Number.isFinite(opts.windowMs) || opts.windowMs <= 0) {
    throw new Error(`dedup '${id}': windowMs must be a positive number`);
  }
  if (downstream.length === 0) throw new Error(`dedup '${id}': missing downstream`);

  let fresh = 0;
  let duplicates = 0;
  // Arrival id -> first-seen time; evicted past the window (FIFO by time).
  const seen: { at: number; reqId: number }[] = [];
  const known = new Set<number>();

  function readId(payload: unknown): number | undefined {
    if (typeof payload === "object" && payload !== null && "id" in payload) {
      const reqId: unknown = payload.id;
      if (typeof reqId === "number" && Number.isInteger(reqId)) return reqId;
    }
    return undefined;
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request" && event.kind !== "write") return;
    const reqId = readId(event.payload);
    while (seen.length > 0) {
      const oldest = seen[0];
      if (oldest === undefined || event.at - oldest.at < opts.windowMs) break;
      seen.shift();
      known.delete(oldest.reqId);
    }
    if (reqId !== undefined && known.has(reqId)) {
      duplicates += 1;
      // Already executed: answer from the dedup record, never re-run.
      ctx.complete(event.at, 1, true);
      return;
    }
    fresh += 1;
    if (reqId !== undefined) {
      known.add(reqId);
      seen.push({ at: event.at, reqId });
    }
    ctx.queue.push(event.at, event.kind, downstream, event.payload);
  }

  function metrics(): { fresh: number; duplicates: number } {
    return { fresh, duplicates };
  }

  function narrate(): string {
    return `dedup(window=${opts.windowMs}ms): fresh=${fresh} duplicates=${duplicates}`;
  }

  return { handler, metrics, narrate };
}
