// apps/web/components/design-canvas.tsx
"use client";

import { useState } from "react";
import { compileFlow } from "@backpressure/canvas";
import { runPreset } from "@backpressure/concept-engine";
import { runChecks } from "@backpressure/coach/checks";
import type { StructuralFinding } from "@backpressure/coach/checks";
import { CanvasEditor } from "./canvas-editor";
import type { EditorGraph } from "./canvas-editor";
import { NarrationFeed } from "./narration-feed";

interface RunReport {
  rows: { label: string; p99: number; verdict: string; narration: string }[];
  checks: StructuralFinding[];
  error: string | null;
}

function seedGraph(): EditorGraph {
  return {
    nodes: [
      { id: "lb", kind: "lb" },
      { id: "web-a", kind: "service" },
      { id: "web-b", kind: "service" },
    ],
    edges: [
      { from: "lb", to: "web-a" },
      { from: "lb", to: "web-b" },
    ],
  };
}

export function DesignCanvas(): JSX.Element {
  const [graph, setGraph] = useState<EditorGraph>(seedGraph);
  const [rps, setRps] = useState<number>(100);
  const [report, setReport] = useState<RunReport | null>(null);

  function runDesign(): void {
    try {
      const topology = compileFlow(
        graph.nodes.map((node) => ({ id: node.id, kind: node.kind, config: {} })),
        graph.edges,
      );
      const preset = {
        id: "canvas-design",
        topology,
        controls: [],
        metrics: ["p99"],
        challenges: [{ id: "canvas.run", text: "Run the design", verdict: "slo.p99" }],
      };
      const result = runPreset(preset, { rps });
      setReport({
        rows: [{ label: "design", p99: result.p99, verdict: result.verdict, narration: result.narration }],
        checks: runChecks(topology, ["no_single_point_of_failure", "cache_between_app_and_db"]),
        error: null,
      });
    } catch (error) {
      setReport({ rows: [], checks: [], error: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div>
      <section aria-label="Canvas" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Canvas</h2>
        <div className="mt-3">
          <CanvasEditor initial={seedGraph()} onChange={setGraph} />
        </div>
      </section>
      <section aria-label="Run" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Run</h2>
        <label className="mt-3 block max-w-xl">
          Traffic (RPS): {rps}
          <input className="block w-full" type="range" min={10} max={300} value={rps} onChange={(e) => setRps(Number(e.currentTarget.value))} />
        </label>
        <button type="button" className="mt-3 border border-ember bg-ember px-3 py-1.5 min-h-[44px] text-paper" onClick={runDesign}>
          Run design
        </button>
      </section>
      {report !== null && (
        <section aria-label="Results" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">Results</h2>
          {report.error !== null ? (
            <p className="mt-3">{report.error}</p>
          ) : (
            <>
              <div className="mt-3 overflow-x-auto border border-ink/20">
              <table className="w-full border-collapse font-mono text-sm">
                <caption className="px-3 py-2 text-left font-mono text-sm text-smoke">Simulation verdicts</caption>
                <thead>
                  <tr className="border-y border-ink/20 text-left">
                    <th scope="col" className="px-3 py-2 font-bold">Design</th>
                    <th scope="col" className="px-3 py-2 font-bold">p99 (ms)</th>
                    <th scope="col" className="px-3 py-2 font-bold">SLO 150ms</th>
                    <th scope="col" className="px-3 py-2 font-bold">What happened</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.label} className="border-b border-ink/10 align-top last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-bold">{row.label}</th>
                      <td className="px-3 py-2 tabular-nums">{Math.round(row.p99)}</td>
                      <td className={row.verdict === "FAIL" ? "px-3 py-2 font-bold text-ember" : "px-3 py-2"}>{row.verdict}</td>
                      <td className="max-w-md px-3 py-2 text-xs leading-relaxed">
                        <NarrationFeed narration={row.narration} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <ul className="mt-3 space-y-1">
                {report.checks.map((check) => (
                  <li key={check.id}>
                    {check.id}: {check.passed ? "PASS" : "FAIL"} — {check.detail}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
