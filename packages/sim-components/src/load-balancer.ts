// packages/sim-components/src/load-balancer.ts
export type LbStrategy = "round-robin" | "least-connections";

export function createLoadBalancer(opts: {
  strategy: LbStrategy;
  backends: string[];
}): { pick: (getInflight: (id: string) => number) => string; narrate: () => string } {
  if (opts.backends.length === 0) throw new Error("load balancer needs at least one backend");
  let cursor = 0;
  let picks = 0;

  function pick(getInflight: (id: string) => number): string {
    picks += 1;
    const first = opts.backends[0];
    if (first === undefined) throw new Error("no backends");
    if (opts.strategy === "round-robin") {
      const chosen = opts.backends[cursor % opts.backends.length];
      cursor += 1;
      return chosen ?? first;
    }
    let best = first;
    let bestLoad = getInflight(first);
    for (const b of opts.backends) {
      const load = getInflight(b);
      if (load < bestLoad) {
        best = b;
        bestLoad = load;
      }
    }
    return best;
  }

  function narrate(): string {
    return `lb(${opts.strategy}): picks=${picks} backends=[${opts.backends.join(",")}]`;
  }

  return { pick, narrate };
}
