// apps/web/components/post-mortem.tsx
"use client";

import { useMemo, useState } from "react";
import { LabPresetSchema, runPreset } from "@backpressure/concept-engine";
import type { LabPreset, PresetValues } from "@backpressure/concept-engine";
import type { Incident } from "../lib/postmortems";
import { MetricTable } from "./metric-table";
import { MetricChart } from "./metric-chart";

export function PostMortem({ incidents }: { incidents: Incident[] }): JSX.Element {
  const [activeId, setActiveId] = useState<string>(incidents[0]?.id ?? "");
  const [picked, setPicked] = useState<string | null>(null);
  const [fixed, setFixed] = useState<boolean>(false);

  const incident = incidents.find((candidate) => candidate.id === activeId) ?? incidents[0];
  if (incident === undefined) throw new Error("no postmortem incidents");

  const broken = useMemo(() => runPreset(incident.preset, incident.values), [incident]);
  const healed = useMemo(
    () => runPreset(incident.preset, { ...incident.values, ...incident.fix.values }),
    [incident],
  );
  const shown = fixed ? healed : broken;

  function select(id: string): void {
    setActiveId(id);
    setPicked(null);
    setFixed(false);
  }

  return (
    <div>
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Incidents">
        {incidents.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={candidate.id === incident.id}
            className={`border px-3 py-1.5 font-mono text-sm ${candidate.id === incident.id ? "border-ember bg-ember text-paper" : "border-ink"}`}
            onClick={() => select(candidate.id)}
          >
            {candidate.title}
          </button>
        ))}
      </div>
      <section aria-label="Symptoms" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Symptoms</h2>
        <p className="mt-3 max-w-2xl leading-relaxed">{incident.brief}</p>
        <MetricTable
          rows={[{ strategy: fixed ? "after fix" : "incident", p99: shown.p99, verdict: shown.verdict, narration: shown.narration }]}
        />
        <MetricChart series={shown.series} slo={150} label={`p99 over time: ${fixed ? "after fix" : "incident"}`} />
      </section>
      <section aria-label="Diagnose" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">01</span>Diagnose
        </h2>
        <ul className="mt-3 space-y-2">
          {incident.diagnoses.map((diagnosis) => (
            <li key={diagnosis.id}>
              <button
                type="button"
                className={`border px-3 py-1.5 text-left ${picked === diagnosis.id ? "border-ember" : "border-ink/30"}`}
                onClick={() => setPicked(diagnosis.id)}
              >
                {diagnosis.text}
              </button>
            </li>
          ))}
        </ul>
        {picked !== null && (
          <p className="mt-3 font-bold">
            {picked === incident.answerId ? "Correct: matches the numbers above." : "Not it: re-read the symptoms."}
          </p>
        )}
      </section>
      <section aria-label="Fix" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">02</span>Fix and verify
        </h2>
        <button
          type="button"
          className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
          disabled={picked !== incident.answerId}
          onClick={() => setFixed(true)}
        >
          Apply fix and re-run
        </button>
        {fixed && <p className="mt-3 max-w-2xl leading-relaxed">{incident.fix.explanation}</p>}
      </section>
    </div>
  );
}

export function parseIncident(raw: unknown): Incident {
  const preset = (raw as { preset?: unknown }).preset;
  return { ...(raw as Incident), preset: LabPresetSchema.parse(preset) };
}
