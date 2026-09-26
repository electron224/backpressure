// apps/web/components/canvas-editor.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { paletteKinds } from "@backpressure/canvas";
import { useTheme } from "./theme-toggle";

export interface EditorGraph {
  nodes: { id: string; kind: string }[];
  edges: { from: string; to: string }[];
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

let nodeCounter = 0;

function toFlowNodes(graph: EditorGraph | null): Node[] {
  if (graph === null) return [];
  return graph.nodes.map((node, i) => ({
    id: node.id,
    type: node.kind,
    position: { x: 50 + (i % 4) * 300, y: 50 + Math.floor(i / 4) * 200 },
    data: { label: node.id },
  }));
}

function toFlowEdges(graph: EditorGraph | null): Edge[] {
  if (graph === null) return [];
  return graph.edges.map((edge, i) => ({ id: `e-${i}`, source: edge.from, target: edge.to }));
}

export function CanvasEditor({
  initial,
  onChange,
}: {
  initial?: EditorGraph | null;
  onChange?: (graph: EditorGraph) => void;
}): JSX.Element {
  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(initial ?? null));
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(initial ?? null));

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

  // Parent stays in sync with every edit (mount included, so the initial
  // graph is gradable without touching anything).
  useEffect(() => {
    if (onChange) {
      onChange({
        nodes: nodes.map((node) => ({ id: node.id, kind: node.type ?? "service" })),
        edges: edges.map((edge) => ({ from: edge.source, to: edge.target })),
      });
    }
  }, [nodes, edges, onChange]);

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

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Node palette">
        {palette.map((kind) => (
          <button key={kind} type="button" className="border border-ink px-3 py-1.5 font-mono text-sm" onClick={() => addNode(kind)}>
            Add {kind}
          </button>
        ))}
      </div>
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
    </div>
  );
}
