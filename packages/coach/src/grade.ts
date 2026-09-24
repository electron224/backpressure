// packages/coach/src/grade.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runChecks } from "./checks.js";
import type { StructuralFinding } from "./checks.js";
import { runPreset } from "@backpressure/concept-engine";
import type { LabPreset, Topology } from "@backpressure/concept-engine";

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
  total: number;
  llmNote: string;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`grading input unreadable at ${path}: ${String(error)}`);
  }
}

function asPreset(problemId: string, topology: Topology, sloP99Ms: number): LabPreset {
  return {
    id: problemId,
    topology,
    controls: [],
    metrics: ["p99"],
    challenges: [{ id: "grade.run", text: "Grade the submission", verdict: "slo.p99" }],
    sloP99Ms,
  };
}

function backendIds(topology: Topology): string[] {
  return topology.nodes.filter((n) => n.kind === "service" || n.kind === "database").map((n) => n.id);
}

export function gradeSubmission(topology: Topology, problemDir: string): GradeReport {
  const rubric = readJson(join(problemDir, "rubric.json")) as { dimensions: GradeDimension[] };
  const scenarios = readJson(join(problemDir, "scenarios.json")) as ScenarioDef[];
  return gradeWith(topology, rubric, scenarios);
}

export function gradeWith(
  topology: Topology,
  rubric: { dimensions: GradeDimension[] },
  scenarios: ScenarioDef[],
): GradeReport {
  const baseline = scenarios.find((s) => s.id === "baseline") ?? scenarios[0];
  if (baseline === undefined) throw new Error("gradeWith needs at least one scenario");
  const values = { rps: baseline.rps, writePct: baseline.writePct ?? 0 };

  const criteria: CriterionResult[] = [];
  const structural: StructuralFinding[] = [];
  const dimensions = rubric.dimensions.map((dimension) => {
    let earned = 0;
    let possible = 0;
    for (const criterion of dimension.criteria) {
      possible += criterion.points;
      if (dimension.grader !== "deterministic" || criterion.check === undefined) continue;
      if (criterion.check === "no_single_point_of_failure" || criterion.check === "cache_between_app_and_db") {
        const [finding] = runChecks(topology, [criterion.check]);
        if (finding === undefined) throw new Error(`check produced no finding: ${criterion.check}`);
        structural.push(finding);
        const got = finding.passed ? criterion.points : 0;
        earned += got;
        criteria.push({ id: criterion.id, points: criterion.points, earned: got, detail: finding.detail });
      } else if (criterion.check === "slo_p99_under_load") {
        const result = runPreset(asPreset("grade", topology, baseline.sloP99Ms), values);
        const got = result.verdict === "PASS" ? criterion.points : 0;
        earned += got;
        criteria.push({
          id: criterion.id,
          points: criterion.points,
          earned: got,
          detail: `baseline p99 ${Math.round(result.p99)}ms vs SLO ${baseline.sloP99Ms}ms`,
        });
      } else if (criterion.check === "survives_each_single_loss") {
        const loss = scenarios.find((s) => s.eachBackend === true) ?? baseline;
        const ids = backendIds(topology);
        let survived = 0;
        for (const id of ids) {
          const result = runPreset(
            asPreset("grade", topology, loss.sloP99Ms),
            { rps: loss.rps, writePct: loss.writePct ?? 0 },
            { dropBackend: id },
          );
          if (result.verdict === "PASS") survived += 1;
        }
        const got = ids.length === 0 ? 0 : Math.round((criterion.points * survived) / ids.length);
        earned += got;
        criteria.push({
          id: criterion.id,
          points: criterion.points,
          earned: got,
          detail: `survived ${survived}/${ids.length} single-backend losses`,
        });
      } else {
        throw new Error(`unknown check '${criterion.check}' (register it in packages/coach/src/checks.ts)`);
      }
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
    total,
    llmNote:
      "LLM coach unavailable without ANTHROPIC_API_KEY: subjective dimensions unscored. Deterministic total covers simulator-checkable criteria only.",
  };
}
