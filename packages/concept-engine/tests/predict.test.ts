// packages/concept-engine/tests/predict.test.ts
import { describe, expect, it } from "vitest";
import { gradePrediction, predictionError } from "../src/predict.js";

describe("predictionError", () => {
  it("is the absolute difference", () => {
    expect(predictionError(100, 146)).toBe(46);
    expect(predictionError(200, 146)).toBe(54);
  });
});

describe("gradePrediction", () => {
  it("passes within the default 50ms tolerance", () => {
    expect(gradePrediction(46)).toBe(true);
    expect(gradePrediction(54)).toBe(false);
  });

  it("respects a custom tolerance boundary", () => {
    expect(gradePrediction(100, 100)).toBe(true);
    expect(gradePrediction(101, 100)).toBe(false);
  });
});
