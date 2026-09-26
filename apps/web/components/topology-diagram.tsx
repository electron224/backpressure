// apps/web/components/topology-diagram.tsx
"use client";

import type { Topology } from "@backpressure/concept-engine";

interface PlacedNode {
  id: string;
  kind: string;
  x: number;
  y: number;
}

export function layoutTopology(topology: Topology): { nodes: PlacedNode[]; edges: { from: string; to: string }[] } {
  const depth = new Map<string, number>();
  const roots = topology.nodes.filter((n) => !topology.edges.some((e) => e.to === n.id)).map((n) => n.id);
  const queue: string[] = [...roots];
  for (const root of roots) depth.set(root, 0);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    const currentDepth = depth.get(current) ?? 0;
    for (const edge of topology.edges) {
      if (edge.from === current && !depth.has(edge.to)) {
        depth.set(edge.to, currentDepth + 1);
        queue.push(edge.to);
      }
    }
  }
  const columns = new Map<number, string[]>();
  for (const node of topology.nodes) {
    const list = columns.get(depth.get(node.id) ?? 0) ?? [];
    list.push(node.id);
    columns.set(depth.get(node.id) ?? 0, list);
  }
  const nodes: PlacedNode[] = [];
  for (const [column, ids] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    ids.forEach((id, row) => {
      const node = topology.nodes.find((n) => n.id === id);
      nodes.push({ id, kind: node?.kind ?? "service", x: 20 + column * 180, y: 20 + row * 64 });
    });
  }
  return { nodes, edges: topology.edges.map((e) => ({ from: e.from, to: e.to })) };
}

const NODE_W = 140;
const NODE_H = 40;

export function TopologyDiagram({ topology }: { topology: Topology }): JSX.Element {
  const { nodes, edges } = layoutTopology(topology);
  const width = Math.max(320, ...nodes.map((n) => n.x + NODE_W + 20));
  const height = Math.max(120, ...nodes.map((n) => n.y + NODE_H + 20));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <figure className="mt-4 border border-ink/20" aria-label="System diagram">
      <figcaption className="px-3 py-2 font-mono text-sm text-smoke">system under test</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img" aria-label="Topology diagram">
        {edges.map((edge, i) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1C2530" strokeOpacity={0.45} strokeWidth={1.5} />;
        })}
        {nodes.map((node) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} fill="#F7F8F7" stroke="#1C2530" strokeWidth={1.5} className="dark:fill-[#12161D]" />
            <text x={node.x + 8} y={node.y + 16} fontSize={9} fill="#5D6D7E" fontFamily="monospace">{node.kind}</text>
            <text x={node.x + 8} y={node.y + 32} fontSize={12} fontWeight="bold" fill="#1C2530" className="dark:fill-[#E9ECF1]">{node.id}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
