// apps/web/components/metric-chart.tsx
"use client";

export interface ChartPoint {
  t: number;
  p99: number;
  throughput: number;
  errors: number;
}

function points(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return "";
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values
    .map((value, i) => {
      const x = Math.round(i * step);
      const y = Math.round(height - (Math.min(value, max) / max) * height);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function MetricChart({
  series,
  slo,
  label,
}: {
  series: ChartPoint[];
  slo: number;
  label: string;
}): JSX.Element {
  const width = 560;
  const height = 120;
  const maxP99 = Math.max(slo * 1.2, ...series.map((p) => p.p99));
  const maxErrors = Math.max(1, ...series.map((p) => p.errors));
  const sloY = Math.round(height - (Math.min(slo, maxP99) / maxP99) * height);
  const errorBars = series.map((p, i) => {
    const step = series.length === 1 ? 0 : width / (series.length - 1);
    const x = Math.round(i * step);
    const h = Math.round((p.errors / maxErrors) * 28);
    return { x, h };
  });
  return (
    <figure className="mt-4 border border-ink/20" aria-label={label}>
      <figcaption className="px-3 py-2 font-mono text-sm text-smoke">{label}</figcaption>
      <svg viewBox={`0 0 ${width} ${height + 32}`} className="block w-full" role="img" aria-label={`${label} chart`}>
        {errorBars.map(
          (bar) =>
            bar.h > 0 && (
              <rect key={bar.x} x={bar.x - 2} y={height + 30 - bar.h} width={4} height={bar.h} fill="#B03A2E" opacity={0.55} />
            ),
        )}
        <line x1={0} y1={sloY} x2={width} y2={sloY} stroke="#B03A2E" strokeDasharray="5 4" strokeWidth={1} />
        <text x={width - 4} y={sloY - 4} textAnchor="end" fontSize={10} fill="#B03A2E" fontFamily="monospace">
          SLO {slo}ms
        </text>
        <path d={points(series.map((p) => p.p99), width, height, maxP99)} fill="none" stroke="#1C2530" strokeWidth={2} />
        <line x1={0} y1={height + 30} x2={width} y2={height + 30} stroke="#1C2530" strokeOpacity={0.2} strokeWidth={1} />
      </svg>
      <div className="flex gap-5 border-t border-ink/10 px-3 py-2 font-mono text-xs text-smoke" aria-hidden="true">
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 bg-ink align-middle" /> p99
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-1 bg-ember align-middle" /> errors
        </span>
        <span className="ml-auto"> ember dashes: SLO threshold</span>
      </div>
    </figure>
  );
}
