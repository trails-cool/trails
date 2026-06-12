import { test, expect, gotoHydrated } from "./fixtures/test";
import { setupVirtualAuthenticator, registerUser } from "./helpers/auth";

// A GPX fixture that carries trackpoint elevation (10 points).
const ELEVATION_GPX = "packages/fit/__fixtures__/alpine.gpx";

test.describe("Elevation profile", () => {
  test("an activity with elevation shows the profile chart on its detail page", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    await registerUser(page, `elev-${stamp}@example.com`, `elev${stamp}`);

    await gotoHydrated(page, "/activities/new");
    await page.getByLabel("Name").fill("Alpine outing");
    await page.locator('input[name="gpx"]').setInputFiles(ELEVATION_GPX);
    await page.getByRole("button", { name: "Create Activity" }).click();

    await expect(page).toHaveURL(/\/activities\/[0-9a-f-]+$/, { timeout: 10000 });

    // The elevation profile chart (svg role=img) and its summary render.
    await expect(page.getByRole("img", { name: "Elevation profile" })).toBeVisible();
    await expect(page.getByText("Highest")).toBeVisible();
  });
});
