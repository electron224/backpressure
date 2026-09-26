// apps/web/components/hero-demo.tsx
"use client";

import { useMemo } from "react";
import { LabPresetSchema, runPreset } from "@backpressure/concept-engine";
import { labPreset } from "../../../content/concepts/load-balancing/lab";

const preset = LabPresetSchema.parse(labPreset);

function sweep(strategy: "round-robin" | "least-connections"): { rps: number; p99: number }[] {
  const points: { rps: number; p99: number }[] = [];
  for (let rps = 20; rps <= 300; rps += 20) {
    const result = runPreset(preset, { strategy, rps });
    points.push({ rps, p99: result.p99 });
  }
  return points;
}

function path(points: { rps: number; p99: number }[], width: number, height: number, max: number): string {
  const step = width / 14;
  return points
    .map((point, i) => {
      const x = Math.round(i * step);
      const y = Math.round(height - (Math.min(point.p99, max) / max) * height);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function HeroDemo(): JSX.Element {
  const curves = useMemo(
    () => ({ rr: sweep("round-robin"), lc: sweep("least-connections") }),
    [],
  );
  const width = 560;
  const height = 180;
  const max = 2500;
  const sloY = Math.round(height - (150 / max) * height);
  return (
    <figure className="mt-6 border border-ink/20 bg-paper" aria-label="Live simulation: p99 divergence as traffic rises">
      <figcaption className="flex flex-wrap gap-x-5 px-3 py-2 font-mono text-sm">
        <span className="text-smoke">live sim: p99 vs traffic</span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 bg-ink align-middle" /> round-robin
        </span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 bg-ember align-middle" /> least-connections
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="block w-full" role="img" aria-label="p99 divergence chart">
        <line x1={0} y1={sloY} x2={width} y2={sloY} stroke="#B03A2E" strokeDasharray="5 4" strokeWidth={1} />
        <text x={width - 4} y={sloY - 4} textAnchor="end" fontSize={10} fill="#B03A2E" fontFamily="monospace">
          SLO 150ms
        </text>
        <path d={path(curves.rr, width, height, max)} fill="none" stroke="#1C2530" strokeWidth={2} />
        <path d={path(curves.lc, width, height, max)} fill="none" stroke="#B03A2E" strokeWidth={2} />
      </svg>
      <p className="border-t border-ink/10 px-3 py-2 font-mono text-xs text-smoke">
        computed in your browser just now: same engine as every lab below
      </p>
    </figure>
  );
}
