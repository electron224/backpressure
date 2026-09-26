// apps/web/components/metric-table.tsx
"use client";

export interface LabRow {
  strategy: string;
  p99: number;
  verdict: "PASS" | "FAIL";
  narration: string;
}

export function MetricTable({ rows }: { rows: LabRow[] }): JSX.Element {
  return (
    <div className="mt-4 overflow-x-auto border border-ink/20">
      <table className="w-full border-collapse text-sm">
        <caption className="px-3 py-2 text-left font-mono text-sm text-smoke">Simulation results by strategy</caption>
        <thead>
          <tr className="border-y border-ink/20 text-left">
            <th scope="col" className="px-3 py-2 font-bold">Strategy</th>
            <th scope="col" className="px-3 py-2 font-bold">p99 (ms)</th>
            <th scope="col" className="px-3 py-2 font-bold">SLO 150ms</th>
            <th scope="col" className="px-3 py-2 font-bold">What happened</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((row) => (
            <tr key={row.strategy} className="border-b border-ink/10 align-top last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-bold">{row.strategy}</th>
              <td className="px-3 py-2 tabular-nums">{Math.round(row.p99)}</td>
              <td className={row.verdict === "FAIL" ? "px-3 py-2 font-bold text-ember" : "px-3 py-2"}>{row.verdict}</td>
              <td className="max-w-md px-3 py-2 text-xs leading-relaxed">{row.narration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
