// packages/concept-engine/src/chaos.ts
import type { Rng, ScenarioEvent } from "@backpressure/sim-core";

export const CHAOS_KILL_PROBABILITY = 0.6;
export const CHAOS_FAULT_AT_MS = 2500;
export const CHAOS_SPIKE_RPS = 160;

export function pickRandomFault(rng: Rng, backends: string[]): ScenarioEvent {
  if (backends.length === 0) {
    throw new Error("pickRandomFault needs at least one backend");
  }
  if (rng.next() < CHAOS_KILL_PROBABILITY) {
    const target = backends[rng.nextInt(backends.length)];
    if (target === undefined) throw new Error("pickRandomFault drew no backend");
    return { at: CHAOS_FAULT_AT_MS, fault: "kill-node", targets: [target] };
  }
  return { at: CHAOS_FAULT_AT_MS, fault: "traffic-spike", rps: CHAOS_SPIKE_RPS };
}
