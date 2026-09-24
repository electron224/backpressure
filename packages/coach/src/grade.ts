// packages/coach/src/grade.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Topology } from "@backpressure/concept-engine";
import { gradeWith } from "./grade-core.js";
import type { GradeDimension, GradeReport, ScenarioDef } from "./grade-core.js";

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`grading input unreadable at ${path}: ${String(error)}`);
  }
}

export function gradeSubmission(topology: Topology, problemDir: string): GradeReport {
  const rubric = readJson(join(problemDir, "rubric.json")) as { dimensions: GradeDimension[] };
  const scenarios = readJson(join(problemDir, "scenarios.json")) as ScenarioDef[];
  return gradeWith(topology, rubric, scenarios);
}
