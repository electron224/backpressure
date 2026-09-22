// packages/sim-components/src/rate-limiter.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export type LimiterAlgorithm = "token-bucket" | "sliding-window";

export interface RateLimiterOpts {
  algorithm: LimiterAlgorithm;
  rps: number;
  burst: number;
}

export function createRateLimiter(
  id: string,
  opts: RateLimiterOpts,
  downstream: string,
): { handler: HandlerFn; metrics: () => { allowed: number; rejected: number }; narrate: () => string } {
  if (!Number.isFinite(opts.rps) || opts.rps <= 0) {
    throw new Error(`rate-limiter '${id}': rps must be a positive number`);
  }
  if (!Number.isFinite(opts.burst) || opts.burst <= 0) {
    throw new Error(`rate-limiter '${id}': burst must be a positive number`);
  }
  if (downstream.length === 0) throw new Error(`rate-limiter '${id}': missing downstream`);

  let allowed = 0;
  let rejected = 0;
  let tokens = opts.burst;
  let lastRefill = 0;
  let windowOf = -1;
  let windowCount = 0;

  function admitTokenBucket(now: number): boolean {
    tokens = Math.min(opts.burst, tokens + ((now - lastRefill) * opts.rps) / 1000);
    lastRefill = now;
    if (tokens >= 1) {
      tokens -= 1;
      return true;
    }
    return false;
  }

  function admitSlidingWindow(now: number): boolean {
    const window = Math.floor(now / 1000);
    if (window !== windowOf) {
      windowOf = window;
      windowCount = 0;
    }
    if (windowCount < opts.rps) {
      windowCount += 1;
      return true;
    }
    return false;
  }

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request") return;
    const admit = opts.algorithm === "sliding-window" ? admitSlidingWindow(event.at) : admitTokenBucket(event.at);
    if (admit) {
      allowed += 1;
      ctx.queue.push(event.at, "request", downstream, event.payload);
    } else {
      rejected += 1;
      ctx.complete(ctx.now, 0, false);
    }
  }

  function metrics(): { allowed: number; rejected: number } {
    return { allowed, rejected };
  }

  function narrate(): string {
    return `limiter(${opts.algorithm} ${opts.rps}rps/burst ${opts.burst}): allowed=${allowed} rejected=${rejected}`;
  }

  return { handler, metrics, narrate };
}
