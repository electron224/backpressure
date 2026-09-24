// packages/sim-components/src/load-balancer.ts
export type LbStrategy = "round-robin" | "least-connections";

export interface BreakerOpts {
  failureThreshold: number;
  cooldownMs: number;
}

type BreakerState = { status: "closed"; streak: number } | { status: "open"; openedAt: number };

export function createLoadBalancer(opts: {
  strategy: LbStrategy;
  backends: string[];
  breaker?: BreakerOpts;
}): {
  pick: (getInflight: (id: string) => number, now?: number) => string;
  recordResult: (id: string, ok: boolean, now: number) => void;
  narrate: () => string;
} {
  if (opts.backends.length === 0) throw new Error("load balancer needs at least one backend");
  if (opts.breaker !== undefined) {
    if (!Number.isInteger(opts.breaker.failureThreshold) || opts.breaker.failureThreshold < 1) {
      throw new Error("breaker failureThreshold must be a positive integer");
    }
    if (!Number.isFinite(opts.breaker.cooldownMs) || opts.breaker.cooldownMs <= 0) {
      throw new Error("breaker cooldownMs must be a positive number");
    }
  }
  let cursor = 0;
  let picks = 0;
  const breakers = new Map<string, BreakerState>();
  for (const b of opts.backends) breakers.set(b, { status: "closed", streak: 0 });

  function isOpen(id: string): boolean {
    return breakers.get(id)?.status === "open";
  }

  function trialEligible(id: string, now: number): boolean {
    const state = breakers.get(id);
    return (
      state !== undefined &&
      state.status === "open" &&
      opts.breaker !== undefined &&
      now - state.openedAt >= opts.breaker.cooldownMs
    );
  }

  function pick(getInflight: (id: string) => number, now?: number): string {
    picks += 1;
    const first = opts.backends[0];
    if (first === undefined) throw new Error("no backends");
    if (opts.breaker !== undefined && now !== undefined) {
      let trial: string | undefined;
      let trialOpened = Number.POSITIVE_INFINITY;
      for (const b of opts.backends) {
        const state = breakers.get(b);
        if (state !== undefined && state.status === "open" && now - state.openedAt >= opts.breaker.cooldownMs) {
          if (state.openedAt < trialOpened) {
            trialOpened = state.openedAt;
            trial = b;
          }
        }
      }
      if (trial !== undefined) return trial;
    }
    const available = opts.backends.filter((b) => !isOpen(b));
    const pool = available.length > 0 ? available : [first];
    if (opts.strategy === "round-robin") {
      for (let i = 0; i < pool.length; i += 1) {
        const chosen = pool[(cursor + i) % pool.length];
        if (chosen !== undefined) {
          cursor += 1;
          return chosen;
        }
      }
      return first;
    }
    let best = pool[0] ?? first;
    let bestLoad = getInflight(best);
    for (const b of pool) {
      const load = getInflight(b);
      if (load < bestLoad) {
        best = b;
        bestLoad = load;
      }
    }
    return best;
  }

  function recordResult(id: string, ok: boolean, now: number): void {
    const state = breakers.get(id);
    if (state === undefined) throw new Error(`unknown backend '${id}'`);
    if (opts.breaker === undefined) return;
    if (!Number.isFinite(now)) throw new Error("breaker recordResult needs a finite now");
    if (ok) {
      breakers.set(id, { status: "closed", streak: 0 });
      return;
    }
    if (state.status === "open") {
      breakers.set(id, { status: "open", openedAt: now });
      return;
    }
    const streak = state.streak + 1;
    if (streak >= opts.breaker.failureThreshold) {
      breakers.set(id, { status: "open", openedAt: now });
    } else {
      breakers.set(id, { status: "closed", streak });
    }
  }

  function narrate(): string {
    const open = opts.backends.filter((b) => isOpen(b));
    return `lb(${opts.strategy}): picks=${picks} backends=[${opts.backends.join(",")}] open=[${open.join(",")}]`;
  }

  return { pick, recordResult, narrate };
}
