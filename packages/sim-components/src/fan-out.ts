// packages/sim-components/src/fan-out.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export interface FanoutOpts {
  writeOnly?: boolean;
}

export function createFanout(
  id: string,
  targets: string[],
  opts?: FanoutOpts,
): { handler: HandlerFn; metrics: () => { fanned: number }; narrate: () => string } {
  if (targets.length === 0) throw new Error(`fan-out '${id}': needs at least one target`);
  function head(): string {
    for (const target of targets) return target;
    throw new Error(`fan-out '${id}': empty target list`);
  }
  const first = head();

  let fanned = 0;

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request" && event.kind !== "write") return;
    // Write-fanout, read-direct: writes pay the multiplier, reads stay
    // single. Without the flag every arrival broadcasts.
    const destinations = opts?.writeOnly === true && event.kind !== "write" ? [first] : targets;
    fanned += 1;
    for (const target of destinations) {
      ctx.queue.push(event.at, event.kind, target, event.payload);
    }
  }

  function metrics(): { fanned: number } {
    return { fanned };
  }

  function narrate(): string {
    return `fan-out(x${targets.length}=[${targets.join(",")}]): fanned=${fanned}`;
  }

  return { handler, metrics, narrate };
}
