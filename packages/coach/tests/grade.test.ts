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

describe("design-twitter references", () => {
  it("v1 naive fails SPOF, v2 passes deterministic", async () => {
    const { v1Naive } = await import("../../../content/problems/design-twitter/reference/v1-naive.js");
    const { v2Scaled } = await import("../../../content/problems/design-twitter/reference/v2-scaled.js");
    const { LabPresetSchema } = await import("@backpressure/concept-engine");
    const v1 = gradeSubmission(LabPresetSchema.parse(v1Naive).topology, "content/problems/design-twitter");
    expect(v1.criteria.find((c) => c.id === "avail.no-spof")?.earned).toBe(0);
    const v2 = gradeSubmission(LabPresetSchema.parse(v2Scaled).topology, "content/problems/design-twitter");
    for (const criterion of v2.criteria) {
      expect(criterion.earned).toBe(criterion.points);
    }
  });
});
