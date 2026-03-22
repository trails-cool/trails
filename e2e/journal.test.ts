import { test, expect } from "@playwright/test";

test.describe("Journal", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("trails.cool");
    await expect(page.getByText("Your outdoor activity journal")).toBeVisible();
  });
});
