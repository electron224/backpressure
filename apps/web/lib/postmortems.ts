// apps/web/lib/postmortems.ts
import { LabPresetSchema } from "@backpressure/concept-engine";
import type { LabPreset, PresetValues } from "@backpressure/concept-engine";

export interface Incident {
  id: string;
  title: string;
  brief: string;
  preset: LabPreset;
  values: PresetValues;
  diagnoses: { id: string; text: string }[];
  answerId: string;
  fix: { values: PresetValues; explanation: string };
}

export function parseIncident(raw: unknown): Incident {
  const record = raw as { preset?: unknown } & Omit<Incident, "preset">;
  return { ...record, preset: LabPresetSchema.parse(record.preset) };
}
