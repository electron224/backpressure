// packages/coach/src/grade-core.ts
import { evaluateCriterion } from "./checks.js";
import type { StructuralFinding } from "./checks.js";
import type { Topology } from "@backpressure/concept-engine";

export interface GradeCriterion {
  id: string;
  check?: string;
  text?: string;
  points: number;
}

export interface GradeDimension {
  id: string;
  weight: number;
  grader: "deterministic" | "llm";
  criteria: GradeCriterion[];
}

export interface ScenarioDef {
  id: string;
  rps: number;
  writePct?: number;
  sloP99Ms: number;
  eachBackend?: boolean;
}

export interface CriterionResult {
  id: string;
  points: number;
  earned: number;
  detail: string;
}

export interface GradeReport {
  dimensions: { id: string; weight: number; earned: number; possible: number }[];
  criteria: CriterionResult[];
  structural: StructuralFinding[];
  verdicts: { id: string; passed: boolean; observed: number }[];
  total: number;
  llmNote: string;
}

export function gradeWith(
  topology: Topology,
  rubric: { dimensions: GradeDimension[] },
  scenarios: ScenarioDef[],
): GradeReport {
  if (scenarios.length === 0) throw new Error("gradeWith needs at least one scenario");

  const criteria: CriterionResult[] = [];
  const structural: StructuralFinding[] = [];
  const verdicts: { id: string; passed: boolean; observed: number }[] = [];
  const dimensions = rubric.dimensions.map((dimension) => {
    let earned = 0;
    let possible = 0;
    for (const criterion of dimension.criteria) {
      possible += criterion.points;
      if (dimension.grader !== "deterministic" || criterion.check === undefined) continue;
      // Every deterministic check resolves through the registry: the same
      // function the linter enforces, the grader executes.
      const evaluation = evaluateCriterion(topology, criterion.check, scenarios);
      const got = Math.round(criterion.points * evaluation.credit);
      earned += got;
      if (
        criterion.check === "no_single_point_of_failure" ||
        criterion.check === "cache_between_app_and_db"
      ) {
        structural.push(evaluation.finding);
      }
      verdicts.push(...evaluation.verdicts);
      criteria.push({ id: criterion.id, points: criterion.points, earned: got, detail: evaluation.finding.detail });
    }
    return { id: dimension.id, weight: dimension.weight, earned, possible };
  });

  const total = Math.round(
    dimensions.reduce((sum, d) => sum + (d.possible > 0 ? (d.earned / d.possible) * d.weight * 100 : 0), 0),
  );
  return {
    dimensions,
    criteria,
    structural,
    verdicts,
    total,
    llmNote:
      "LLM coach unavailable without a provider key: subjective dimensions unscored. Deterministic total covers simulator-checkable criteria only.",
  };
}
