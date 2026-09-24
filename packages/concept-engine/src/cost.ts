// packages/concept-engine/src/cost.ts
import type { LabPreset } from "./schema.js";

// Model constants (documented here, not real-world prices): base $/mo per
// node plus size terms, plus $0.40 per million requests. The point is
// comparing architectures, not forecasting AWS bills.
export const COST_PER_MILLION_REQUESTS = 0.4;
export const SECONDS_PER_MONTH = 2_592_000;

export interface CostLine {
  label: string;
  monthlyUsd: number;
}

export interface CostEstimate {
  monthlyUsd: number;
  lines: CostLine[];
}

function serviceCost(config: Record<string, unknown>): number {
  const concurrency: unknown = config["concurrency"];
  const units = typeof concurrency === "number" && Number.isFinite(concurrency) ? concurrency : 2;
  return 50 + 10 * units;
}

export function estimateCost(preset: LabPreset, rps: number): CostEstimate {
  const lines: CostLine[] = [];
  for (const node of preset.topology.nodes) {
    const record = node.config;
    if (node.kind === "service") {
      lines.push({ label: `${node.id} (service)`, monthlyUsd: serviceCost(record) });
    } else if (node.kind === "database") {
      const replicas: unknown = record["replicas"];
      const count = Array.isArray(replicas) && replicas.length > 0 ? replicas.length : 1;
      lines.push({ label: `${node.id} (database x${count})`, monthlyUsd: (200 + 50) * count });
    } else if (node.kind === "cache") {
      lines.push({ label: `${node.id} (cache)`, monthlyUsd: 30 });
    } else {
      lines.push({ label: `${node.id} (${node.kind})`, monthlyUsd: 20 });
    }
  }
  const requestsPerMonth = Math.max(0, rps) * SECONDS_PER_MONTH;
  lines.push({
    label: `traffic (${rps} RPS)`,
    monthlyUsd: (requestsPerMonth / 1_000_000) * COST_PER_MILLION_REQUESTS,
  });
  const monthlyUsd = lines.reduce((sum, line) => sum + line.monthlyUsd, 0);
  return { monthlyUsd, lines };
}
