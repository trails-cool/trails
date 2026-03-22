import { test, expect } from "@playwright/test";

test.describe("Planner", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("trails.cool Planner");
    await expect(page.getByText("Collaborative route planning")).toBeVisible();
  });
});
