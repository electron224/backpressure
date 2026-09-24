// apps/web/lib/presets.ts
import { LabPresetSchema } from "@backpressure/concept-engine";
import type { LabPreset } from "@backpressure/concept-engine";
// Extensionless: matches the existing web import style (moduleResolution "node").
import { labPreset as loadBalancing } from "../../../content/concepts/load-balancing/lab";
import { labPreset as singlePointOfFailure } from "../../../content/concepts/single-point-of-failure/lab";
import { labPreset as latencyAndThroughput } from "../../../content/concepts/latency-and-throughput/lab";
import { labPreset as verticalVsHorizontalScaling } from "../../../content/concepts/vertical-vs-horizontal-scaling/lab";
import { labPreset as statelessness } from "../../../content/concepts/statelessness/lab";
import { labPreset as backOfEnvelopeEstimation } from "../../../content/concepts/back-of-envelope-estimation/lab";
import { labPreset as rateLimiting } from "../../../content/concepts/rate-limiting/lab";
import { labPreset as reverseProxyVsApiGateway } from "../../../content/concepts/reverse-proxy-vs-api-gateway/lab";
import { labPreset as cdn } from "../../../content/concepts/cdn/lab";
import { labPreset as healthChecksAndCircuitBreakers } from "../../../content/concepts/health-checks-and-circuit-breakers/lab";
import { labPreset as cachingStrategies } from "../../../content/concepts/caching-strategies/lab";
import { labPreset as evictionPolicies } from "../../../content/concepts/eviction-policies/lab";
import { labPreset as replication } from "../../../content/concepts/replication/lab";
import { labPreset as sharding } from "../../../content/concepts/sharding/lab";
import { labPreset as capTheorem } from "../../../content/concepts/cap-theorem/lab";
import { labPreset as pacelc } from "../../../content/concepts/pacelc/lab";
import { labPreset as quorumsAndNRW } from "../../../content/concepts/quorums-and-n-r-w/lab";
import { labPreset as consistencyModels } from "../../../content/concepts/consistency-models/lab";
import { labPreset as consistentHashing } from "../../../content/concepts/consistent-hashing/lab";
import { labPreset as sqlVsNosql } from "../../../content/concepts/sql-vs-nosql/lab";
import { labPreset as indexing } from "../../../content/concepts/indexing/lab";

const presets: Record<string, unknown> = {
  "load-balancing": loadBalancing,
  "single-point-of-failure": singlePointOfFailure,
  "latency-and-throughput": latencyAndThroughput,
  "vertical-vs-horizontal-scaling": verticalVsHorizontalScaling,
  statelessness,
  "back-of-envelope-estimation": backOfEnvelopeEstimation,
  "rate-limiting": rateLimiting,
  "reverse-proxy-vs-api-gateway": reverseProxyVsApiGateway,
  cdn,
  "health-checks-and-circuit-breakers": healthChecksAndCircuitBreakers,
  "caching-strategies": cachingStrategies,
  "eviction-policies": evictionPolicies,
  replication,
  sharding,
  "cap-theorem": capTheorem,
  pacelc,
  "consistency-models": consistencyModels,
  "quorums-and-n-r-w": quorumsAndNRW,
  "consistent-hashing": consistentHashing,
  "sql-vs-nosql": sqlVsNosql,
  indexing,
};

export function presetSlugs(): string[] {
  return Object.keys(presets);
}

export function getPreset(slug: string): LabPreset {
  const raw: unknown = presets[slug];
  if (raw === undefined) throw new Error(`unknown concept preset: ${slug}`);
  return LabPresetSchema.parse(raw);
}
