// packages/sim-components/src/service.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface ServiceOpts {
  serviceMs: number;
  concurrency: number;
  queueLimit: number;
  downstream?: string;
}

function readArrival(payload: unknown, fallback: number): number {
  if (typeof payload === "object" && payload !== null && "arrival" in payload) {
    const arrival: unknown = payload.arrival;
    if (typeof arrival === "number" && Number.isFinite(arrival)) return arrival;
  }
  return fallback;
}

export function createService(id: string, opts: ServiceOpts): {
  handler: HandlerFn;
  metrics: () => { queueDepth: number; inflight: number };
  narrate: () => string;
} {
  let inflight = 0;
  const waiting: { arrival: number }[] = [];
  let served = 0;
  let dropped = 0;

  function startOne(ctx: EngineContext, arrival: number): void {
    inflight += 1;
    const endAt = ctx.now + opts.serviceMs;
    ctx.queue.push(endAt, `complete:${id}`, id, { arrival });
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind === "request") {
      if (inflight < opts.concurrency) {
        startOne(ctx, event.at);
      } else if (waiting.length < opts.queueLimit) {
        waiting.push({ arrival: event.at });
      } else {
        dropped += 1;
        ctx.complete(ctx.now, 0, false);
      }
      return;
    }
    if (event.kind === `complete:${id}`) {
      inflight = Math.max(0, inflight - 1);
      served += 1;
      ctx.complete(event.at, event.at - readArrival(event.payload, event.at), true);
      const next = waiting.shift();
      if (next) startOne(ctx, next.arrival);
      return;
    }
  }

  function metrics(): { queueDepth: number; inflight: number } {
    return { queueDepth: waiting.length, inflight };
  }

  function narrate(): string {
    return `${id}: served=${served} dropped=${dropped} inflight=${inflight} queued=${waiting.length}`;
  }

  return { handler, metrics, narrate };
}
