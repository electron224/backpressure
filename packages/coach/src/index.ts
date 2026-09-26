// packages/coach/src/index.ts
export { CHECKS, cacheBetweenAppAndDb, noSinglePointOfFailure, runChecks } from "./checks.js";
export type { StructuralFinding } from "./checks.js";
export { gradeSubmission } from "./grade.js";
export { gradeWith } from "./grade-core.js";
export type { CriterionResult, GradeDimension, GradeReport, ScenarioDef } from "./grade-core.js";
export { RUBRIC_VERSION, coachDeepDive, CoachFeedbackSchema } from "./llm.js";
export type { CoachFeedback, CoachInput, CoachResult } from "./llm.js";
