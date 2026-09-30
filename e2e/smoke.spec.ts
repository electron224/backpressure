// e2e/smoke.spec.ts
import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home renders catalogue and interview entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Learn system design by running it/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "mock loops" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Design canvas", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "broken architecture" })).toBeVisible();
  });

  test("lab numbers are deterministic across reloads", async ({ page }) => {
    await page.goto("/concepts/load-balancing");
    const row = page.locator("table").first().locator("tbody tr").first();
    await expect(row).toBeVisible();
    const p99Before = await row.locator("td").first().textContent();
    await page.reload();
    const p99After = await page.locator("table").first().locator("tbody tr").first().locator("td").first().textContent();
    expect(p99After).toBe(p99Before);
    expect(Number(p99After)).toBeGreaterThan(0);
  });

  test("lab exposes the four-stage loop controls", async ({ page }) => {
    await page.goto("/concepts/load-balancing");
    await expect(page.getByRole("region", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Predict then reveal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inject random fault" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recall" })).toBeVisible();
  });
});
