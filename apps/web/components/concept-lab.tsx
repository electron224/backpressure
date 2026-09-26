// apps/web/components/concept-lab.tsx
"use client";

import { useMemo, useState } from "react";
import { createRng } from "@backpressure/sim-core";
import {
  createProgress,
  estimateCost,
  gradePrediction,
  pickRandomFault,
  predictionError,
  runPreset,
} from "@backpressure/concept-engine";
import type { Challenge, LabPreset, PresetValues, RecallItem, StorageLike, Topology } from "@backpressure/concept-engine";
import { MetricTable } from "./metric-table";
import type { LabRow } from "./metric-table";
import { MetricChart } from "./metric-chart";
import { RequestWaterfall } from "./request-waterfall";
import { TopologyDiagram } from "./topology-diagram";

const SEED = 7;

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

function formatRow(label: string, p99: number, verdict: "PASS" | "FAIL"): string {
  return `${label} p99 ${Math.round(p99)}ms ${verdict}`;
}

export function ConceptLab({
  slug,
  preset,
  challenges,
  recall,
}: {
  slug: string;
  preset: LabPreset;
  challenges: Challenge[];
  recall: RecallItem[];
}): JSX.Element {
  const progress = useMemo(() => createProgress(browserStore()), []);
  const [values, setValues] = useState<PresetValues>(() => {
    const init: PresetValues = {};
    for (const control of preset.controls) {
      init[control.id] = control.def;
    }
    return init;
  });
  const [prediction, setPrediction] = useState<number>(150);
  const [committed, setCommitted] = useState<number | null>(null);
  const [chaosNote, setChaosNote] = useState<string>("No fault injected yet.");
  const [dropped, setDropped] = useState<string | undefined>(undefined);
  const [chaosRps, setChaosRps] = useState<number | undefined>(undefined);
  const [chaosCount, setChaosCount] = useState<number>(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // The first select control fans out into comparison rows; each row overrides
  // that control's id with its option. Presets without a select get one row
  // per topology variant (or a single base row).
  const selectControl = preset.controls.find((control) => control.kind === "select");
  const topos = preset.variants !== undefined && preset.variants.length > 0 ? preset.variants : [{ label: "base" }];
  const strats: (string | undefined)[] = selectControl?.options ?? [undefined];

  interface ExpandedRow extends LabRow {
    strat: string | undefined;
    series: { t: number; p99: number; throughput: number; errors: number }[];
    completions: { at: number; latencyMs: number; ok: boolean }[];
    topology: Topology;
  }

  const expanded: ExpandedRow[] = [];
  for (const topo of topos) {
    for (const strat of strats) {
      const parts: string[] = [];
      if (topo.label !== "base") parts.push(topo.label);
      if (strat !== undefined) parts.push(strat);
      const label = parts.join(" ") || "base";
      const topology = topo.topology ?? preset.topology;
      const rowValues: PresetValues = { ...values };
      if (selectControl !== undefined && strat !== undefined) {
        rowValues[selectControl.id] = strat;
      }
      if (chaosRps !== undefined) {
        rowValues["rps"] = chaosRps;
      }
      const result = runPreset(
        { ...preset, topology },
        rowValues,
        dropped === undefined ? undefined : { dropBackend: dropped },
      );
      expanded.push({ strategy: label, p99: result.p99, verdict: result.verdict, narration: result.narration, strat, series: result.series, completions: result.completions, topology });
    }
  }
  const rows: LabRow[] = expanded.map(({ strategy, p99, verdict, narration }) => ({ strategy, p99, verdict, narration }));
  const first = expanded[0];
  if (first === undefined) throw new Error(`preset '${preset.id}' produced no rows`);
  const actualRow =
    selectControl === undefined ? first : (expanded.find((row) => row.strat === values[selectControl.id]) ?? first);
  const actual = actualRow.p99;

  const rpsValue: unknown = chaosRps ?? values["rps"];
  const effectiveRps = typeof rpsValue === "number" ? rpsValue : 0;
  const descriptor =
    selectControl === undefined ? actualRow.strategy : String(values[selectControl.id] ?? actualRow.strategy);

  function commitPrediction(): void {
    setCommitted(prediction);
    const error = predictionError(prediction, actual);
    progress.logPrediction(slug, { predicted: prediction, actual, error });
    progress.completeStage(slug, "predict");
  }

  function injectChaos(): void {
    // Deterministic counter seed — never Date.now() (determinism discipline).
    // Backends are the union of service ids across the base topology and all
    // variant topologies, so variant-specific backends are killable too.
    // Unknown drop ids stay a no-op inside runPreset.
    const topologies = [preset.topology, ...(preset.variants ?? []).flatMap((v) => (v.topology ? [v.topology] : []))];
    const backends = [
      ...new Set(
        topologies.flatMap((topology) => topology.nodes.filter((node) => node.kind === "service" || node.kind === "rate-limiter" || node.kind === "shard-router" || node.kind === "dedup" || node.kind === "pipe" || node.kind === "queue" || node.kind === "fan-out").map((node) => node.id)),
      ),
    ];
    const fault = pickRandomFault(createRng(SEED + chaosCount * 101), backends);
    setChaosCount((c) => c + 1);
    if (fault.fault === "kill-node") {
      const target = fault.targets?.[0] ?? backends[0];
      if (target === undefined) {
        setChaosNote("Chaos: no backends to kill in this topology.");
        return;
      }
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

  function attemptChallenge(id: string): void {
    setDropped(undefined);
    setChaosRps(undefined);
    setChaosNote("No fault injected yet.");
    const challenge = challenges.find((c) => c.id === id);
    const patch = challenge?.apply?.set;
    if (patch !== undefined) {
      setValues((prev) => ({ ...prev, ...patch }));
    }
    progress.completeStage(slug, "stress");
  }

  function liveResult(id: string): string {
    const challenge = challenges.find((c) => c.id === id);
    const shown = challenge?.show === undefined ? rows : rows.filter((row) => row.strategy === challenge.show);
    if (shown.length === 0) return "no result yet";
    return shown.map((row) => formatRow(row.strategy, row.p99, row.verdict)).join(" vs ");
  }

  return (
    <div>
      <section aria-label="Play" className="mt-10 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">02</span>Play
        </h2>
        {preset.controls.map((control) =>
          control.kind === "select" ? (
            <label key={control.id} className="mt-3 block max-w-xl">
              {control.label}{" "}
              <select
                className="ml-2 border border-ink/30 bg-paper px-2 py-1"
                value={String(values[control.id] ?? control.def)}
                onChange={(e) => {
                  const next = e.currentTarget.value;
                  setValues((prev) => ({ ...prev, [control.id]: next }));
                }}
              >
                {(control.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label key={control.id} className="mt-3 block max-w-xl">
              {control.label}: {String(values[control.id] ?? control.def)}
              <input
                className="block w-full"
                type="range"
                min={control.min ?? 0}
                max={control.max ?? 100}
                value={Number(values[control.id] ?? control.def)}
                onChange={(e) => {
                  const next = Number(e.currentTarget.value);
                  setValues((prev) => ({ ...prev, [control.id]: next }));
                }}
              />
            </label>
          ),
        )}
        <TopologyDiagram topology={actualRow.topology} />
        <MetricTable rows={rows} />
        <RequestWaterfall
          completions={actualRow.completions}
          durationMs={5000}
          slo={preset.sloP99Ms ?? 150}
          label={`requests live: ${actualRow.strategy}`}
        />
        <MetricChart series={actualRow.series} slo={preset.sloP99Ms ?? 150} label={`p99 over time: ${actualRow.strategy}`} />
        <p className="mt-3 font-mono text-sm text-smoke">
          Estimated cost: ${Math.round(estimateCost(preset, effectiveRps).monthlyUsd)}/mo at {effectiveRps} RPS (model rates,
          for comparing architectures).
        </p>
      </section>

      <section aria-label="Predict then reveal" className="mt-10 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">03</span>Predict, then reveal
        </h2>
        <label className="mt-3 block max-w-xl">
          What will p99 be at {effectiveRps} RPS with {descriptor}? {prediction}ms
          <input
            className="block w-full disabled:opacity-50"
            type="range"
            min={0}
            max={3000}
            value={prediction}
            onChange={(e) => setPrediction(Number(e.currentTarget.value))}
            disabled={committed !== null}
          />
        </label>
        {committed === null ? (
          <button type="button" className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper" onClick={commitPrediction}>
            Commit prediction and run
          </button>
        ) : (
          <p className="mt-3 max-w-xl leading-relaxed">
            You predicted {committed}ms; actual {Math.round(actual)}ms; error {Math.round(predictionError(committed, actual))}ms —{" "}
            {gradePrediction(predictionError(committed, actual)) ? "within 50ms, nice." : "off by more than 50ms."}{" "}
            <button type="button" className="border border-ink px-3 py-1.5" onClick={() => setCommitted(null)}>
              Predict again
            </button>
          </p>
        )}
      </section>

      <section aria-label="Chaos" className="mt-10 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">04</span>Chaos button
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed">
          Kills a random backend or spikes traffic, so you can watch the survivor cope. Try it right after a clean
          run: compare the two tables and find what broke first.
        </p>
        <button type="button" className="mt-3 border border-ink px-3 py-1.5" onClick={injectChaos}>
          Inject random fault
        </button>
        <p className="mt-2">{chaosNote}</p>
      </section>

      <section aria-label="Stress" className="mt-10 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">05</span>Stress
        </h2>
        <ul>
          {challenges.map((c) => (
            <li key={c.id} className="border-b border-ink/10 py-2">
              {c.text} — verdict: {c.verdict} — live: {liveResult(c.id)}{" "}
              <button type="button" className="ml-2 border border-ink px-3 py-1.5" onClick={() => attemptChallenge(c.id)}>
                Attempt {c.id}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Recall" className="mt-10 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">06</span>Recall
        </h2>
        <ul>
          {recall.map((item) => (
            <li key={item.id} className="border-b border-ink/10 py-2">
              <p>{item.q}</p>
              {revealed[item.id] ? (
                <p className="mt-1 border-l-2 border-ember pl-3">{item.a}</p>
              ) : (
                <button
                  type="button"
                  className="mt-1 border border-ink px-3 py-1.5"
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
