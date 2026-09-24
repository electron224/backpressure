// apps/web/components/design-canvas.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import type { Connection, Edge, EdgeChange, Node, NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { compileFlow, paletteKinds } from "@backpressure/canvas";
import { runPreset } from "@backpressure/concept-engine";
import { runChecks } from "@backpressure/coach";
import type { StructuralFinding } from "@backpressure/coach";

interface RunReport {
  rows: { label: string; p99: number; verdict: string; narration: string }[];
  checks: StructuralFinding[];
  error: string | null;
}

let nodeCounter = 0;

function seedNodes(): Node[] {
  return [
    { id: "lb", type: "lb", position: { x: 50, y: 150 }, data: { label: "lb" } },
    { id: "web-a", type: "service", position: { x: 350, y: 50 }, data: { label: "web-a" } },
    { id: "web-b", type: "service", position: { x: 350, y: 250 }, data: { label: "web-b" } },
  ];
}

function seedEdges(): Edge[] {
  return [
    { id: "e-lb-a", source: "lb", target: "web-a" },
    { id: "e-lb-b", source: "lb", target: "web-b" },
  ];
}

export function DesignCanvas(): JSX.Element {
  const [nodes, setNodes] = useState<Node[]>(seedNodes);
  const [edges, setEdges] = useState<Edge[]>(seedEdges);
  const [rps, setRps] = useState<number>(100);
  const [report, setReport] = useState<RunReport | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((current) => applyEdgeChanges(changes, current)),
    [],
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((current) => addEdge(connection, current)),
    [],
  );

  const palette = useMemo(() => paletteKinds(), []);

  function addNode(kind: string): void {
    nodeCounter += 1;
    const id = `${kind}-${nodeCounter}`;
    setNodes((current) => [
      ...current,
      { id, type: kind, position: { x: 50 + (nodeCounter % 5) * 40, y: 50 + (nodeCounter % 5) * 40 }, data: { label: id } },
    ]);
  }

  function runDesign(): void {
    try {
      const topology = compileFlow(
        nodes.map((node) => ({ id: node.id, kind: node.type ?? "service", config: {} })),
        edges.map((edge) => ({ from: edge.source, to: edge.target })),
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
      <section aria-label="Palette">
        <h2>Palette (constrained: simulatable nodes only)</h2>
        {palette.map((kind) => (
          <button key={kind} type="button" onClick={() => addNode(kind)}>
            Add {kind}
          </button>
        ))}
      </section>
      <section aria-label="Canvas">
        <h2>Canvas</h2>
        <div style={{ height: 400 }}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </section>
      <section aria-label="Run">
        <h2>Run</h2>
        <label>
          Traffic (RPS): {rps}
          <input type="range" min={10} max={300} value={rps} onChange={(e) => setRps(Number(e.currentTarget.value))} />
        </label>
        <button type="button" onClick={runDesign}>
          Run design
        </button>
      </section>
      {report !== null && (
        <section aria-label="Results">
          <h2>Results</h2>
          {report.error !== null ? (
            <p>{report.error}</p>
          ) : (
            <>
              <table>
                <caption>Simulation verdicts</caption>
                <thead>
                  <tr>
                    <th scope="col">Design</th>
                    <th scope="col">p99 (ms)</th>
                    <th scope="col">SLO 150ms</th>
                    <th scope="col">What happened</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{Math.round(row.p99)}</td>
                      <td>{row.verdict}</td>
                      <td>{row.narration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul>
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
