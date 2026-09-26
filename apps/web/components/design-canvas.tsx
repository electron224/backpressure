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
import type { Connection, Edge, EdgeChange, Node, NodeChange, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { compileFlow, paletteKinds } from "@backpressure/canvas";
import { runPreset } from "@backpressure/concept-engine";
import { runChecks } from "@backpressure/coach/checks";
import type { StructuralFinding } from "@backpressure/coach/checks";
import { NarrationFeed } from "./narration-feed";
import { useTheme } from "./theme-toggle";

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

function SimNode({ data, type }: NodeProps): JSX.Element {
  const label = typeof data?.label === "string" ? data.label : "node";
  return (
    <div className="border-2 border-ink bg-paper px-3 py-2 shadow-none">
      <div className="font-mono text-[10px] uppercase tracking-wide text-smoke">{type}</div>
      <div className="text-sm font-bold">{label}</div>
    </div>
  );
}

const NODE_TYPES = {
  lb: SimNode,
  service: SimNode,
  "rate-limiter": SimNode,
  cache: SimNode,
  database: SimNode,
  "shard-router": SimNode,
  dedup: SimNode,
  pipe: SimNode,
  queue: SimNode,
  "fan-out": SimNode,
};

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
  const theme = useTheme();

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
      <section aria-label="Palette" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Palette (constrained: simulatable nodes only)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {palette.map((kind) => (
            <button key={kind} type="button" className="border border-ink px-3 py-1.5 font-mono text-sm" onClick={() => addNode(kind)}>
              Add {kind}
            </button>
          ))}
        </div>
      </section>
      <section aria-label="Canvas" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Canvas</h2>
        <div className="bp-flow mt-3 border border-ink/20" style={{ height: 400 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            colorMode={theme}
          >
            <Background gap={24} />
            <Controls />
          </ReactFlow>
        </div>
        <p className="mt-2 font-mono text-xs text-smoke">drag to move, drag between handles to connect, select + Backspace deletes</p>
      </section>
      <section aria-label="Run" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Run</h2>
        <label className="mt-3 block max-w-xl">
          Traffic (RPS): {rps}
          <input className="block w-full" type="range" min={10} max={300} value={rps} onChange={(e) => setRps(Number(e.currentTarget.value))} />
        </label>
        <button type="button" className="mt-3 border border-ember bg-ember px-3 py-1.5 text-paper" onClick={runDesign}>
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
