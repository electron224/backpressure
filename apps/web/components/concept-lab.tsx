// apps/web/components/concept-lab.tsx
"use client";

import { useMemo, useState } from "react";
import { compile, createRng, run } from "@backpressure/sim-core";
import type { HandlerFn } from "@backpressure/sim-core";
import { createLoadBalancer, createService } from "@backpressure/sim-components";
import type { LbStrategy } from "@backpressure/sim-components";
import {
  createProgress,
  gradePrediction,
  pickRandomFault,
  predictionError,
} from "@backpressure/concept-engine";
import type { Challenge, RecallItem, StorageLike } from "@backpressure/concept-engine";
// 3 levels up: components -> web -> apps -> repo root (plan's 4-up path is a typo).
import { labPreset } from "../../../content/concepts/load-balancing/lab";
import { MetricTable } from "./metric-table";
import type { LabRow } from "./metric-table";

const SEED = 7;
const SLO_P99_MS = 150;

interface ServiceConfig {
  serviceMs: number;
  concurrency: number;
  queueLimit: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberField(config: Record<string, unknown>, key: string, fallback: number): number {
  const value: unknown = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// Type-guard read over the preset node config (global no-`as` rule wins over a cast).
function serviceConfig(id: string): ServiceConfig {
  const node = labPreset.topology.nodes.find((n) => n.id === id);
  const raw: unknown = node?.config;
  if (!isRecord(raw)) {
    return { serviceMs: 20, concurrency: 2, queueLimit: 50 };
  }
  return {
    serviceMs: numberField(raw, "serviceMs", 20),
    concurrency: numberField(raw, "concurrency", 2),
    queueLimit: numberField(raw, "queueLimit", 50),
  };
}

// SSR-safe store: client components prerender on the server, where `window`
// does not exist. Fall back to an in-memory store for that first render.
function browserStore(): StorageLike {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function runStrategy(strategy: LbStrategy, rps: number, dropBackend?: string): { p99: number; narration: string } {
  const backends = ["fast", "slow"].filter((b) => b !== dropBackend);
  const graph = compile({
    nodes: [
      { id: "lb", kind: "lb", config: {} },
      ...backends.map((b) => ({ id: b, kind: "service", config: {} })),
    ],
    edges: backends.map((b) => ({ from: "lb", to: b })),
  });
  const services = new Map(backends.map((b) => [b, createService(b, serviceConfig(b))]));
  const lb = createLoadBalancer({ strategy, backends });
  const handlers = new Map<string, HandlerFn>([
    [
      "lb",
      (event, ctx) => {
        if (event.kind !== "request") return;
        const target = lb.pick((id) => {
          const svc = services.get(id);
          const m = svc?.metrics();
          return (m?.inflight ?? 0) + (m?.queueDepth ?? 0);
        });
        ctx.queue.push(event.at, "request", target, { arrival: event.at });
      },
    ],
  ]);
  for (const [id, svc] of services) handlers.set(id, svc.handler);
  const result = run({ seed: SEED, graph, traffic: { rps, durationMs: 5000 }, handlers, sloP99Ms: SLO_P99_MS });
  const p99 = result.verdicts.find((v) => v.id === "slo.p99")?.observed ?? 0;
  const narration = [lb.narrate(), ...[...services.values()].map((s) => s.narrate())].join(" | ");
  return { p99, narration };
}

export function ConceptLab({
  slug,
  challenges,
  recall,
}: {
  slug: string;
  challenges: Challenge[];
  recall: RecallItem[];
}): JSX.Element {
  const progress = useMemo(() => createProgress(browserStore()), []);
  const [strategy, setStrategy] = useState<LbStrategy>("round-robin");
  const [rps, setRps] = useState<number>(80);
  const [prediction, setPrediction] = useState<number>(150);
  const [committed, setCommitted] = useState<number | null>(null);
  const [chaosNote, setChaosNote] = useState<string>("No fault injected yet.");
  const [dropped, setDropped] = useState<string | undefined>(undefined);
  const [chaosRps, setChaosRps] = useState<number | undefined>(undefined);
  const [chaosCount, setChaosCount] = useState<number>(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const effectiveRps = chaosRps ?? rps;
  const strategies: LbStrategy[] = ["round-robin", "least-connections"];
  const rows: LabRow[] = strategies.map((s) => {
    const { p99, narration } = runStrategy(s, effectiveRps, dropped);
    return { strategy: s, p99, verdict: p99 <= SLO_P99_MS ? "PASS" : "FAIL", narration };
  });
  const current = rows.find((r) => r.strategy === strategy);
  const actual = current?.p99 ?? 0;

  function commitPrediction(): void {
    setCommitted(prediction);
    const error = predictionError(prediction, actual);
    progress.logPrediction(slug, { predicted: prediction, actual, error });
    progress.completeStage(slug, "predict");
  }

  function injectChaos(): void {
    // Deterministic counter seed — never Date.now() (determinism discipline).
    const fault = pickRandomFault(createRng(SEED + chaosCount * 101), ["fast", "slow"]);
    setChaosCount((c) => c + 1);
    if (fault.fault === "kill-node") {
      const target = fault.targets?.[0] ?? "slow";
      setDropped(target);
      setChaosRps(undefined);
      setChaosNote(`Chaos: killed ${target}. Re-run shows the surviving backend alone.`);
    } else {
      setDropped(undefined);
      setChaosRps(fault.rps ?? 160);
      setChaosNote(`Chaos: traffic spike to ${fault.rps ?? 160} RPS for this run.`);
    }
    progress.completeStage(slug, "play");
  }

  function onStrategyChange(value: string): void {
    setStrategy(value === "least-connections" ? "least-connections" : "round-robin");
  }

  return (
    <div>
      <section aria-label="Play">
        <h2>Play</h2>
        <label>
          Strategy
          <select value={strategy} onChange={(e) => onStrategyChange(e.currentTarget.value)}>
            <option value="round-robin">round-robin</option>
            <option value="least-connections">least-connections</option>
          </select>
        </label>
        <label>
          Traffic (RPS): {rps}
          <input type="range" min={10} max={300} value={rps} onChange={(e) => setRps(Number(e.currentTarget.value))} />
        </label>
        <MetricTable rows={rows} />
      </section>

      <section aria-label="Predict then reveal">
        <h2>Predict, then reveal</h2>
        <label>
          What will p99 be at {effectiveRps} RPS with {strategy}? {prediction}ms
          <input
            type="range"
            min={0}
            max={3000}
            value={prediction}
            onChange={(e) => setPrediction(Number(e.currentTarget.value))}
            disabled={committed !== null}
          />
        </label>
        {committed === null ? (
          <button type="button" onClick={commitPrediction}>
            Commit prediction and run
          </button>
        ) : (
          <p>
            You predicted {committed}ms; actual {Math.round(actual)}ms; error {Math.round(predictionError(committed, actual))}ms —{" "}
            {gradePrediction(predictionError(committed, actual)) ? "within 50ms, nice." : "off by more than 50ms."}{" "}
            <button type="button" onClick={() => setCommitted(null)}>
              Predict again
            </button>
          </p>
        )}
      </section>

      <section aria-label="Chaos">
        <h2>Chaos button</h2>
        <button type="button" onClick={injectChaos}>
          Inject random fault
        </button>
        <p>{chaosNote}</p>
      </section>

      <section aria-label="Stress">
        <h2>Stress</h2>
        <ul>
          {challenges.map((c) => (
            <li key={c.id}>
              {c.text} — verdict: {c.verdict}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Recall">
        <h2>Recall</h2>
        <ul>
          {recall.map((item) => (
            <li key={item.id}>
              <p>{item.q}</p>
              {revealed[item.id] ? (
                <p>{item.a}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRevealed((prev) => ({ ...prev, [item.id]: true }));
                    progress.completeStage(slug, "recall");
                  }}
                >
                  Reveal answer
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
