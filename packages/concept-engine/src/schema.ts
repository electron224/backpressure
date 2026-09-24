// packages/concept-engine/src/schema.ts
import { z } from "zod";

export const ConceptMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prerequisites: z.array(z.string()),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimated_minutes: z.number().int().positive(),
  tags: z.array(z.string()),
});

export type ConceptMeta = z.infer<typeof ConceptMetaSchema>;

export const ChallengeApplySchema = z.object({
  set: z.record(z.union([z.string(), z.number()])).optional(),
});

export type ChallengeApply = z.infer<typeof ChallengeApplySchema>;

export const ChallengeSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  verdict: z.string().min(1),
  apply: ChallengeApplySchema.optional(),
  show: z.string().min(1).optional(),
});

export type Challenge = z.infer<typeof ChallengeSchema>;

export const ChallengesSchema = z.array(ChallengeSchema).min(1);

export const RecallItemSchema = z.object({
  id: z.string().min(1),
  q: z.string().min(1),
  a: z.string().min(1),
});

export type RecallItem = z.infer<typeof RecallItemSchema>;

export const RecallItemsSchema = z.array(RecallItemSchema).min(1);

export const TopologyNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["lb", "service", "rate-limiter", "cache", "database"]),
  config: z.record(z.unknown()),
});

export type TopologyNode = z.infer<typeof TopologyNodeSchema>;

export const TopologySchema = z.object({
  nodes: z.array(TopologyNodeSchema).min(1),
  edges: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })),
});

export type Topology = z.infer<typeof TopologySchema>;

export const LabControlSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.enum(["select", "slider"]),
    options: z.array(z.string().min(1)).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    def: z.union([z.string(), z.number()]),
  })
  .superRefine((control, ctx) => {
    if (control.kind === "select" && (!control.options || control.options.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `select control '${control.id}' needs non-empty options` });
    }
    if (control.kind === "slider" && (control.min === undefined || control.max === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `slider control '${control.id}' needs min and max` });
    }
  });

export type LabControl = z.infer<typeof LabControlSchema>;

export const PresetVariantSchema = z.object({
  label: z.string().min(1),
  topology: TopologySchema.optional(),
});

export type PresetVariant = z.infer<typeof PresetVariantSchema>;

export const LabPresetSchema = z.object({
  id: z.string().min(1),
  topology: TopologySchema,
  controls: z.array(LabControlSchema),
  metrics: z.array(z.string()),
  challenges: ChallengesSchema,
  variants: z.array(PresetVariantSchema).optional(),
  sloP99Ms: z.number().positive().optional(),
});

export type LabPreset = z.infer<typeof LabPresetSchema>;
export type PresetValues = Record<string, string | number>;
