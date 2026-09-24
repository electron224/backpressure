// packages/sim-components/src/service.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface ServiceOpts {
  serviceMs: number;
  concurrency: number;
  queueLimit: number;
  downstream?: string;
  readMs?: number;
  writeMs?: number;
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
  const waiting: { arrival: number; kind: "request" | "write" }[] = [];
  let served = 0;
  let dropped = 0;

  // Read/write latency split (defaults preserve legacy serviceMs for both).
  const readMs = opts.readMs ?? opts.serviceMs;
  const writeMs = opts.writeMs ?? opts.serviceMs;
  if (!Number.isFinite(readMs) || readMs <= 0) {
    throw new Error(`service '${id}': readMs must be a positive number`);
  }
  if (!Number.isFinite(writeMs) || writeMs <= 0) {
    throw new Error(`service '${id}': writeMs must be a positive number`);
  }

  function startOne(ctx: EngineContext, arrival: number, costMs: number): void {
    inflight += 1;
    const endAt = ctx.now + costMs;
    ctx.queue.push(endAt, `complete:${id}`, id, { arrival });
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    // Reads and writes share the service path; admission lives upstream.
    if (event.kind === "request" || event.kind === "write") {
      const costMs = event.kind === "write" ? writeMs : readMs;
      if (inflight < opts.concurrency) {
        startOne(ctx, event.at, costMs);
      } else if (waiting.length < opts.queueLimit) {
        waiting.push({ arrival: event.at, kind: event.kind === "write" ? "write" : "request" });
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
      if (next) startOne(ctx, next.arrival, next.kind === "write" ? writeMs : readMs);
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
