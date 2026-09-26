// packages/concept-engine/tests/postmortem-content.test.ts
import { describe, expect, it } from "vitest";
import { LabPresetSchema, runPreset } from "../src/index.js";
import { fridayDeploy } from "../../../content/postmortems/friday-deploy.js";
import { flakyFriday } from "../../../content/postmortems/flaky-friday.js";

describe("postmortems", () => {
  it("friday-deploy reproduces FAIL and the fix restores PASS", () => {
    const preset = LabPresetSchema.parse(fridayDeploy.preset);
    const broken = runPreset(preset, fridayDeploy.values);
    expect(broken.verdict).toBe("FAIL");
    const fixed = runPreset(preset, { ...fridayDeploy.values, ...fridayDeploy.fix.values });
    expect(fixed.verdict).toBe("PASS");
  });

  it("flaky-friday errors collapse with the breaker fix", () => {
    const preset = LabPresetSchema.parse(flakyFriday.preset);
    const broken = runPreset(preset, flakyFriday.values);
    const fixed = runPreset(preset, { ...flakyFriday.values, ...flakyFriday.fix.values });
    expect(broken.rejected).toBeGreaterThan(fixed.rejected * 2);
  });

  it("answer ids exist in diagnoses", () => {
    for (const incident of [fridayDeploy, flakyFriday]) {
      expect(incident.diagnoses.some((d) => d.id === incident.answerId)).toBe(true);
    }
  });
});
