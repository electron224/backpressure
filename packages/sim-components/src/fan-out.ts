// packages/sim-components/src/fan-out.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export function createFanout(
  id: string,
  targets: string[],
): { handler: HandlerFn; metrics: () => { fanned: number }; narrate: () => string } {
  if (targets.length === 0) throw new Error(`fan-out '${id}': needs at least one target`);

  let fanned = 0;

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request" && event.kind !== "write") return;
    fanned += 1;
    for (const target of targets) {
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
