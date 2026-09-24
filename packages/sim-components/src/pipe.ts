// packages/sim-components/src/pipe.ts
import type { EngineContext, HandlerFn, SimEvent } from "@backpressure/sim-core";

export function createPipe(
  id: string,
  downstream: string,
): { handler: HandlerFn; metrics: () => { forwarded: number }; narrate: () => string } {
  if (downstream.length === 0) throw new Error(`pipe '${id}': missing downstream`);

  let forwarded = 0;

  function handler(event: SimEvent, ctx: EngineContext): void {
    if (event.kind !== "request" && event.kind !== "write") return;
    forwarded += 1;
    ctx.queue.push(event.at, event.kind, downstream, event.payload);
  }

  function metrics(): { forwarded: number } {
    return { forwarded };
  }

  function narrate(): string {
    return `pipe(${id}->${downstream}): forwarded=${forwarded}`;
  }

  return { handler, metrics, narrate };
}
