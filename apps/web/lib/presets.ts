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
};

export function presetSlugs(): string[] {
  return Object.keys(presets);
}

export function getPreset(slug: string): LabPreset {
  const raw: unknown = presets[slug];
  if (raw === undefined) throw new Error(`unknown concept preset: ${slug}`);
  return LabPresetSchema.parse(raw);
}
