// packages/coach/src/index.ts
export { CHECKS, cacheBetweenAppAndDb, noSinglePointOfFailure, runChecks } from "./checks.js";
export type { StructuralFinding } from "./checks.js";
export { gradeSubmission, gradeWith } from "./grade.js";
export type { CriterionResult, GradeDimension, GradeReport, ScenarioDef } from "./grade.js";
