// e2e/design.spec.ts
import { expect, test } from "@playwright/test";

test.describe("design canvas", () => {
  test("runs a starter topology and reports a verdict", async ({ page }) => {
    await page.goto("/design");
    await expect(page.getByRole("button", { name: "Add cache" })).toBeVisible();
    await page.getByRole("button", { name: "Run design" }).click();
    await expect(page.getByRole("region", { name: "Results" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Simulation verdicts" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /^(PASS|FAIL)$/ }).first()).toBeVisible();
  });

  test("canvas palette adds and renders a node", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Add queue" }).click();
    await expect(page.getByText("queue-1", { exact: true })).toBeVisible();
  });
});
