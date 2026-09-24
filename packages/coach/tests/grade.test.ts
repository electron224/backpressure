// packages/coach/tests/grade.test.ts
import { describe, expect, it } from "vitest";
import { gradeSubmission } from "../src/grade.js";
import { v1Single } from "../../../content/problems/design-url-shortener/reference/v1-single.js";
import { v2Scaled } from "../../../content/problems/design-url-shortener/reference/v2-scaled.js";
import { LabPresetSchema } from "@backpressure/concept-engine";

const PROBLEM_DIR = "content/problems/design-url-shortener";

describe("gradeSubmission", () => {
  it("v1 fails SPOF and single-loss", () => {
    const topology = LabPresetSchema.parse(v1Single).topology;
    const report = gradeSubmission(topology, PROBLEM_DIR);
    const spof = report.criteria.find((c) => c.id === "avail.no-spof");
    expect(spof?.earned).toBe(0);
    const loss = report.criteria.find((c) => c.id === "avail.single-loss");
    expect(loss?.earned).toBe(0);
  });

  it("v2 passes every deterministic criterion", () => {
    const topology = LabPresetSchema.parse(v2Scaled).topology;
    const report = gradeSubmission(topology, PROBLEM_DIR);
    for (const criterion of report.criteria) {
      expect(criterion.earned).toBe(criterion.points);
    }
    expect(report.llmNote).toContain("ANTHROPIC_API_KEY");
  });
});
