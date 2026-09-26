// apps/web/components/fixit-lab.tsx
"use client";

import { useState } from "react";
import { compileFlow } from "@backpressure/canvas";
import { runPreset } from "@backpressure/concept-engine";
import { CanvasEditor } from "./canvas-editor";
import type { EditorGraph } from "./canvas-editor";
import { MetricTable } from "./metric-table";
import { MetricChart } from "./metric-chart";

export interface Fixit {
  id: string;
  title: string;
  concept: string;
  story: string;
  start: EditorGraph;
  rps: number;
  killSurvive?: boolean;
}

export function FixitLab({ fixit }: { fixit: Fixit }): JSX.Element {
  const [graph, setGraph] = useState<EditorGraph>(fixit.start);
  const [checked, setChecked] = useState<{
    p99: number;
    verdict: "PASS" | "FAIL";
    narration: string;
    series: { t: number; p99: number; throughput: number; errors: number }[];
    kills: { target: string; verdict: "PASS" | "FAIL" }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function check(): void {
    try {
      const topology = compileFlow(
        graph.nodes.map((node) => ({ id: node.id, kind: node.kind, config: {} })),
        graph.edges,
      );
      const preset = {
        id: `fixit-${fixit.id}`,
        topology,
        controls: [],
        metrics: ["p99"],
        challenges: [{ id: "fixit.run", text: "Check the fix", verdict: "slo.p99" }],
      };
      const result = runPreset(preset, { rps: fixit.rps });
      const kills: { target: string; verdict: "PASS" | "FAIL" }[] = [];
      if (fixit.killSurvive === true) {
        const backends = topology.nodes
          .filter((node) => node.kind === "service" || node.kind === "database")
          .map((node) => node.id);
        for (const target of backends) {
          const killed = runPreset(preset, { rps: fixit.rps }, { dropBackend: target });
          kills.push({ target, verdict: killed.verdict });
        }
      }
      const verdict = result.verdict === "PASS" && kills.every((kill) => kill.verdict === "PASS") ? "PASS" : "FAIL";
      setChecked({ p99: result.p99, verdict, narration: result.narration, series: result.series, kills });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setChecked(null);
    }
  }

  return (
    <div>
      <section aria-label="Broken architecture" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">01</span>The patient
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed">{fixit.story}</p>
        <p className="mt-2 font-mono text-sm text-smoke">
          Related lab: <a href={`/concepts/${fixit.concept}`} className="hover:text-ember">{fixit.concept}</a> — traffic: {fixit.rps} RPS
        </p>
      </section>
      <section aria-label="Fix" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">
          <span className="mr-3 font-mono text-sm font-normal text-smoke">02</span>Operate
        </h2>
        <div className="mt-3">
          <CanvasEditor key={fixit.id} initial={fixit.start} onChange={setGraph} />
        </div>
        <button type="button" className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper" onClick={check}>
          Check the fix at {fixit.rps} RPS
        </button>
      </section>
      {error !== null && <p className="mt-3 font-bold text-ember">{error}</p>}
      {checked !== null && (
        <section aria-label="Verdict" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">
            <span className="mr-3 font-mono text-sm font-normal text-smoke">03</span>
            {checked.verdict === "PASS" ? "Fixed" : "Still broken"}
          </h2>
          <MetricTable rows={[{ strategy: "fix", p99: checked.p99, verdict: checked.verdict, narration: checked.narration }]} />
          <MetricChart series={checked.series} slo={150} label="p99 over time: fix" />
          {checked.kills.length > 0 && (
            <ul className="mt-3 space-y-1 font-mono text-sm">
              {checked.kills.map((kill) => (
                <li key={kill.target} className="border-b border-ink/10 pb-1">
                  kill {kill.target}: {kill.verdict}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
