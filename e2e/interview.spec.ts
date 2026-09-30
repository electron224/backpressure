// e2e/interview.spec.ts
import { expect, test } from "@playwright/test";

const CARD_TITLES = ["EU data residency", "Budget cut 40%", "Lose one AZ", "5x traffic spike", "Slow dependency"];

async function goToDesignPhase(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/problems/design-url-shortener");
  await page.locator("textarea").last().fill("Functional: shorten and redirect links. NFR: p99 under 150ms at 1k RPS. Out of scope: analytics and SSO.");
  await page.getByRole("button", { name: "Commit requirements" }).click();
  await page.locator("textarea").last().fill("10M DAU, 12 reads/user/day: 10M x 12 / 86400 = ~1.4k read QPS; writes 10k/day, trivial.");
  await page.getByRole("button", { name: "Commit estimation" }).click();
  await page.locator("textarea").last().fill("GET /short/:code -> { url, clicks }; POST /shorten { url } -> code. Entity: ShortUrl(code PK, url, created_at).");
  await page.getByRole("button", { name: "Commit API and data model" }).click();
  await expect(page.getByRole("heading", { name: /High-level design \(15 min/ })).toBeVisible();
}

test.describe("interview flow", () => {
  test("persona dial renders, selects, and persists", async ({ page }) => {
    await page.goto("/problems/design-url-shortener");
    await expect(page.getByRole("group", { name: "Interviewer persona" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Collaborative/ })).toBeChecked();
    await page.getByRole("radio", { name: /Adversarial/ }).check();
    await expect(page.getByRole("radio", { name: /Adversarial/ })).toBeChecked();
    await page.reload();
    await expect(page.getByRole("radio", { name: /Adversarial/ })).toBeChecked();
  });

  test("design phase flips a constraint card into the transcript", async ({ page }) => {
    await goToDesignPhase(page);
    await page.getByRole("button", { name: "Flip a constraint card" }).click();
    await expect(page.getByRole("button", { name: "Flip another" })).toBeVisible();
    const counts = await Promise.all(CARD_TITLES.map((title) => page.getByText(title, { exact: true }).count()));
    const visible = CARD_TITLES.find((_, i) => (counts[i] ?? 0) > 0);
    if (visible === undefined) throw new Error("no constraint card rendered");
    await expect(page.getByText(visible, { exact: true })).toBeVisible();
  });
});
