// apps/web/components/grade-form.tsx
"use client";

import { useState } from "react";
import { compileFlow } from "@backpressure/canvas";
import { gradeWith } from "@backpressure/coach/grade-core";
import type { GradeDimension, GradeReport, ScenarioDef } from "@backpressure/coach/grade-core";
import type { Topology } from "@backpressure/concept-engine";
import { CanvasEditor } from "./canvas-editor";
import type { EditorGraph } from "./canvas-editor";

const STARTER: EditorGraph = {
  nodes: [
    { id: "lb", kind: "lb" },
    { id: "api", kind: "service" },
  ],
  edges: [{ from: "lb", to: "api" }],
};

export function GradeForm({
  rubric,
  scenarios,
  onReport,
  onTopology,
}: {
  rubric: { dimensions: GradeDimension[] };
  scenarios: ScenarioDef[];
  onReport?: (report: GradeReport) => void;
  onTopology?: (topology: Topology) => void;
}): JSX.Element {
  const [graph, setGraph] = useState<EditorGraph>(STARTER);
  const [report, setReport] = useState<GradeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  function grade(): void {
    try {
      const topology = compileFlow(
        graph.nodes.map((node) => ({ id: node.id, kind: node.kind, config: {} })),
        graph.edges,
      );
      if (onTopology) onTopology(topology);
      const graded = gradeWith(topology, rubric, scenarios);
      setReport(graded);
      setError(null);
      if (onReport) onReport(graded);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReport(null);
    }
  }

  return (
    <div>
      <section aria-label="Submit" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Draw your topology</h2>
        <p className="mt-3 max-w-2xl leading-relaxed">Constrained palette on purpose: every node simulates.</p>
        <div className="mt-3">
          <CanvasEditor initial={STARTER} onChange={setGraph} />
        </div>
        <button type="button" className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper" onClick={grade}>
          Grade submission
        </button>
      </section>
      {error !== null && <p className="mt-3 font-bold text-ember">{error}</p>}
      {report !== null && (
        <section aria-label="Grade report" className="mt-8 border-t border-ink/20 pt-4">
          <h2 className="text-xl font-bold">
            Total: {report.total}/100
          </h2>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            {report.criteria.map((criterion) => (
              <li key={criterion.id} className="border-b border-ink/10 pb-1">
                {criterion.id}: {criterion.earned}/{criterion.points} — {criterion.detail}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-smoke">{report.llmNote}</p>
        </section>
      )}
    </div>
  );
}
