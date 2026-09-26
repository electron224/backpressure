// apps/web/components/scale-ladder.tsx
"use client";

import { useState } from "react";
import { compileFlow } from "@backpressure/canvas";
import { gradeWith } from "@backpressure/coach/grade-core";
import type { GradeDimension, GradeReport, ScenarioDef } from "@backpressure/coach/grade-core";
import type { Topology } from "@backpressure/concept-engine";
import { CanvasEditor } from "./canvas-editor";
import type { EditorGraph } from "./canvas-editor";

const RUNGS = [
  { id: "rung-1", name: "Rung 1: launch traffic", factor: 1 },
  { id: "rung-2", name: "Rung 2: 10x growth", factor: 10 },
  { id: "rung-3", name: "Rung 3: 100x scale", factor: 100 },
];

const STARTER: EditorGraph = {
  nodes: [
    { id: "lb", kind: "lb" },
    { id: "api", kind: "service" },
  ],
  edges: [{ from: "lb", to: "api" }],
};

function scaleScenarios(scenarios: ScenarioDef[], factor: number): ScenarioDef[] {
  return scenarios.map((scenario) => ({ ...scenario, rps: scenario.rps * factor }));
}

function parseGraph(text: string): EditorGraph {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) throw new Error("topology must be a JSON object");
  const record = parsed as { nodes?: { id: string; type?: string; kind?: string }[]; edges?: { from?: string; to?: string; source?: string; target?: string }[] };
  return {
    nodes: (record.nodes ?? []).map((node) => ({ id: node.id, kind: node.type ?? node.kind ?? "service" })),
    edges: (record.edges ?? []).map((edge) => ({ from: edge.from ?? edge.source ?? "", to: edge.to ?? edge.target ?? "" })),
  };
}

export function ScaleLadder({
  slug,
  rubric,
  scenarios,
}: {
  slug: string;
  rubric: { dimensions: GradeDimension[] };
  scenarios: ScenarioDef[];
}): JSX.Element {
  const [rungIndex, setRungIndex] = useState<number>(0);
  const [graph, setGraph] = useState<EditorGraph>(STARTER);
  const [reports, setReports] = useState<(GradeReport | null)[]>([null, null, null]);
  const [error, setError] = useState<string | null>(null);

  const rung = RUNGS[rungIndex];
  if (rung === undefined) throw new Error("ladder rung out of range");
  const graded: GradeReport | null = reports[rungIndex] ?? null;

  function gradeRung(): void {
    const current = RUNGS[rungIndex];
    if (current === undefined) {
      setError("unknown ladder rung");
      return;
    }
    try {
      const topology: Topology = compileFlow(
        graph.nodes.map((node) => ({ id: node.id, kind: node.kind, config: {} })),
        graph.edges,
      );
      const report = gradeWith(topology, rubric, scaleScenarios(scenarios, current.factor));
      setReports((prev) => prev.map((existing, i) => (i === rungIndex ? report : existing)));
      setError(null);
      try {
        window.localStorage.setItem(`bp:ladder:${slug}:${current.id}`, JSON.stringify(graph));
      } catch {
        // Private mode: carry-forward simply does not persist.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function loadRung(index: number): void {
    setRungIndex(index);
    setError(null);
    const target = RUNGS[index];
    if (target === undefined) {
      setError("unknown ladder rung");
      return;
    }
    try {
      const saved = window.localStorage.getItem(`bp:ladder:${slug}:${target.id}`);
      if (saved !== null) setGraph(parseGraph(saved));
    } catch {
      // No saved topology: keep current graph as the carry-forward.
    }
  }

  return (
    <div>
      <ol className="mt-8 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm" aria-label="Scale rungs">
        {RUNGS.map((r, i) => {
          const gradedRung: GradeReport | null = reports[i] ?? null;
          return (
            <li key={r.id} className={i === rungIndex ? "font-bold text-ember" : "text-smoke"}>
              <button type="button" className="hover:text-ember" onClick={() => loadRung(i)}>
                {r.name}
              </button>{" "}
              {gradedRung !== null ? `— ${gradedRung.total}/100` : ""}
            </li>
          );
        })}
      </ol>
      <section aria-label="Ladder rung" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">{rung.name} (×{rung.factor} traffic)</h2>
        <p className="mt-3 max-w-2xl leading-relaxed">
          Evolve the same design upward. Your topology carries forward between rungs — the numbers decide if it
          survives growth.
        </p>
        <div className="mt-3">
          <CanvasEditor key={rung.id} initial={graph} onChange={setGraph} />
        </div>
        <button type="button" className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper" onClick={gradeRung}>
          Grade rung {rungIndex + 1}
        </button>
      </section>
      {error !== null && <p className="mt-3 font-bold text-ember">{error}</p>}
      {graded !== null && (
        <section aria-label="Rung report" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">
            Rung {rungIndex + 1} total: {graded.total}/100
          </h2>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            {graded.criteria.map((criterion) => (
              <li key={criterion.id} className="border-b border-ink/10 pb-1">
                {criterion.id}: {criterion.earned}/{criterion.points} — {criterion.detail}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
