// apps/web/lib/presets.ts
import { LabPresetSchema } from "@backpressure/concept-engine";
import type { LabPreset } from "@backpressure/concept-engine";
// Extensionless: matches the existing web import style (moduleResolution "node").
import { labPreset as loadBalancing } from "../../../content/concepts/load-balancing/lab";

const presets: Record<string, unknown> = { "load-balancing": loadBalancing };

export function presetSlugs(): string[] {
  return Object.keys(presets);
}

export function getPreset(slug: string): LabPreset {
  const raw: unknown = presets[slug];
  if (raw === undefined) throw new Error(`unknown concept preset: ${slug}`);
  return LabPresetSchema.parse(raw);
}
