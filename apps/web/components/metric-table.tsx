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
    <table>
      <caption>Simulation results by strategy</caption>
      <thead>
        <tr>
          <th scope="col">Strategy</th>
          <th scope="col">p99 (ms)</th>
          <th scope="col">SLO 150ms</th>
          <th scope="col">What happened</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.strategy}>
            <th scope="row">{row.strategy}</th>
            <td>{Math.round(row.p99)}</td>
            <td>{row.verdict}</td>
            <td>{row.narration}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
