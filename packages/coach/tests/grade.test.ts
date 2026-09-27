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
    expect(report.llmNote).toContain("provider key");
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

describe("design-video references", () => {
  it("v1 fails, v2 passes deterministic", async () => {
    const { v1SingleOrigin } = await import("../../../content/problems/design-video/reference/v1-single-origin.js");
    const { v2Cdn } = await import("../../../content/problems/design-video/reference/v2-cdn.js");
    const { LabPresetSchema } = await import("@backpressure/concept-engine");
    const v1 = gradeSubmission(LabPresetSchema.parse(v1SingleOrigin).topology, "content/problems/design-video");
    expect(v1.criteria.find((c) => c.id === "avail.no-spof")?.earned).toBe(0);
    expect(v1.criteria.find((c) => c.id === "perf.read-p99")?.earned).toBe(0);
    const v2 = gradeSubmission(LabPresetSchema.parse(v2Cdn).topology, "content/problems/design-video");
    for (const criterion of v2.criteria) {
      expect(criterion.earned).toBe(criterion.points);
    }
  });
});

describe("design-chat references", () => {
  it("v1 fails availability, v2 passes deterministic", async () => {
    const { v1Single } = await import("../../../content/problems/design-chat/reference/v1-single.js");
    const { v2Queued } = await import("../../../content/problems/design-chat/reference/v2-queued.js");
    const { LabPresetSchema } = await import("@backpressure/concept-engine");
    const v1 = gradeSubmission(LabPresetSchema.parse(v1Single).topology, "content/problems/design-chat");
    expect(v1.criteria.find((c) => c.id === "avail.no-spof")?.earned).toBe(0);
    expect(v1.criteria.find((c) => c.id === "avail.single-loss")?.earned).toBe(0);
    const v2 = gradeSubmission(LabPresetSchema.parse(v2Queued).topology, "content/problems/design-chat");
    for (const criterion of v2.criteria) {
      expect(criterion.earned).toBe(criterion.points);
    }
  });
});

describe("design-dropbox references", () => {
  it("v1 fails availability and cache, v2 passes deterministic", async () => {
    const { v1Single } = await import("../../../content/problems/design-dropbox/reference/v1-single.js");
    const { v2Replicated } = await import("../../../content/problems/design-dropbox/reference/v2-replicated.js");
    const { LabPresetSchema } = await import("@backpressure/concept-engine");
    const v1 = gradeSubmission(LabPresetSchema.parse(v1Single).topology, "content/problems/design-dropbox");
    expect(v1.criteria.find((c) => c.id === "avail.no-spof")?.earned).toBe(0);
    expect(v1.criteria.find((c) => c.id === "perf.cache-if-db")?.earned).toBe(0);
    const v2 = gradeSubmission(LabPresetSchema.parse(v2Replicated).topology, "content/problems/design-dropbox");
    for (const criterion of v2.criteria) {
      expect(criterion.earned).toBe(criterion.points);
    }
  });
});
