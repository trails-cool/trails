import { test, expect, gotoHydrated } from "./fixtures/test";
import { setupVirtualAuthenticator, registerUser } from "./helpers/auth";

// GPX with geometry → the activity has a non-zero distance, so the weekly
// chart has a bar to draw (it hides when there's no distance in the window).
const GPX = "packages/fit/__fixtures__/alpine.gpx";

test.describe("Profile weekly distance", () => {
  test("profile shows the weekly distance chart when there is recent distance", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    const username = `wd${stamp}`;
    await registerUser(page, `wd-${stamp}@example.com`, username);

    await gotoHydrated(page, "/activities/new");
    await page.getByLabel("Name").fill("Weekly chart check");
    await page.locator('input[name="gpx"]').setInputFiles(GPX);
    await page.getByRole("button", { name: "Create Activity" }).click();
    await expect(page).toHaveURL(/\/activities\/[0-9a-f-]+$/, { timeout: 10000 });

    await gotoHydrated(page, `/users/${username}`);
    await expect(page.getByText(/Weekly distance/)).toBeVisible();
  });
});
