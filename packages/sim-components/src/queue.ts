// packages/sim-components/src/queue.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface QueueOpts {
  drainRps: number;
  maxDepth: number;
  poisonEvery: number;
}

export function createQueue(
  id: string,
  opts: QueueOpts,
  downstream: string,
): {
  handler: HandlerFn;
  metrics: () => { depth: number; enqueued: number; rejected: number; deadLettered: number };
  narrate: () => string;
} {
  if (!Number.isFinite(opts.drainRps) || opts.drainRps <= 0) {
    throw new Error(`queue '${id}': drainRps must be a positive number`);
  }
  if (!Number.isInteger(opts.maxDepth) || opts.maxDepth < 0) {
    throw new Error(`queue '${id}': maxDepth must be a non-negative integer`);
  }
  if (!Number.isInteger(opts.poisonEvery) || opts.poisonEvery < 0) {
    throw new Error(`queue '${id}': poisonEvery must be a non-negative integer`);
  }
  if (downstream.length === 0) throw new Error(`queue '${id}': missing downstream`);

  let tokens = 0;
  let lastRefill = 0;
  let enqueued = 0;
  let dropped = 0;
  let deadLettered = 0;
  const backlog: { arrival: number }[] = [];

  function readId(payload: unknown): number | undefined {
    if (typeof payload === "object" && payload !== null && "id" in payload) {
      const reqId: unknown = payload.id;
      if (typeof reqId === "number" && Number.isInteger(reqId)) return reqId;
    }
    return undefined;
  }

  function drain(now: number, ctx: EngineContext): void {
    tokens = Math.min(opts.drainRps, tokens + ((now - lastRefill) * opts.drainRps) / 1000);
    lastRefill = now;
    while (tokens >= 1 && backlog.length > 0) {
      const next = backlog.shift();
      if (next === undefined) break;
      tokens -= 1;
      ctx.queue.push(now, "request", downstream, { arrival: next.arrival });
    }
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request" && event.kind !== "write") return;
    drain(event.at, ctx);
    const reqId = readId(event.payload);
    // Poison fraction models permanently failing messages: they skip the
    // main flow into the dead-letter count instead of blocking consumers.
    if (opts.poisonEvery > 0 && reqId !== undefined && reqId % opts.poisonEvery === 0) {
      deadLettered += 1;
      ctx.complete(event.at, 1, true);
      return;
    }
    if (tokens >= 1 && backlog.length === 0) {
      tokens -= 1;
      enqueued += 1;
      ctx.queue.push(event.at, event.kind, downstream, event.payload);
      return;
    }
    if (backlog.length < opts.maxDepth) {
      backlog.push({ arrival: event.at });
      enqueued += 1;
      return;
    }
    dropped += 1;
    ctx.complete(ctx.now, 0, false);
  }

  function metrics(): { depth: number; enqueued: number; rejected: number; deadLettered: number } {
    return { depth: backlog.length, enqueued, rejected: dropped, deadLettered };
  }

  function narrate(): string {
    const lag = opts.drainRps > 0 ? backlog.length / opts.drainRps : 0;
    return `queue(drain=${opts.drainRps}rps depth=${backlog.length} lag~${lag.toFixed(1)}s): enqueued=${enqueued} dropped=${dropped} dlq=${deadLettered}`;
  }

  return { handler, metrics, narrate };
}
