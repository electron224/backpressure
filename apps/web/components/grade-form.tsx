// apps/web/components/grade-form.tsx
"use client";

import { useState } from "react";
import { compileFlow } from "@backpressure/canvas";
import { gradeWith } from "@backpressure/coach/grade-core";
import type { GradeDimension, GradeReport, ScenarioDef } from "@backpressure/coach/grade-core";

interface CanvasNode {
  id: string;
  type?: string;
  kind?: string;
}

interface CanvasEdge {
  source: string;
  target: string;
}

export function GradeForm({
  rubric,
  scenarios,
}: {
  rubric: { dimensions: GradeDimension[] };
  scenarios: ScenarioDef[];
}): JSX.Element {
  const [text, setText] = useState<string>('{"nodes": [{"id": "lb", "kind": "lb", "config": {}}, {"id": "api", "kind": "service", "config": {}}], "edges": [{"from": "lb", "to": "api"}]}');
  const [report, setReport] = useState<GradeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  function grade(): void {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null) throw new Error("topology must be a JSON object");
      const record = parsed as { nodes?: CanvasNode[]; edges?: CanvasEdge[] };
      const topology = compileFlow(
        (record.nodes ?? []).map((node) => ({ id: node.id, kind: node.type ?? node.kind ?? "service", config: {} })),
        (record.edges ?? []).map((edge) => ({ from: edge.source ?? "", to: edge.target ?? "" })),
      );
      setReport(gradeWith(topology, rubric, scenarios));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReport(null);
    }
  }

  return (
    <div>
      <section aria-label="Submit">
        <h2>Submit your topology</h2>
        <p>Paste canvas topology JSON (nodes with id/kind, edges with from/to), or design on the canvas page.</p>
        <label>
          Topology JSON
          <textarea value={text} onChange={(e) => setText(e.currentTarget.value)} rows={8} cols={60} />
        </label>
        <button type="button" onClick={grade}>
          Grade submission
        </button>
      </section>
      {error !== null && <p>{error}</p>}
      {report !== null && (
        <section aria-label="Grade report">
          <h2>
            Total: {report.total}/100
          </h2>
          <ul>
            {report.criteria.map((criterion) => (
              <li key={criterion.id}>
                {criterion.id}: {criterion.earned}/{criterion.points} — {criterion.detail}
              </li>
            ))}
          </ul>
          <p>{report.llmNote}</p>
        </section>
      )}
    </div>
  );
}
