import { test, expect, gotoHydrated } from "./fixtures/test";
import { setupVirtualAuthenticator, registerUser } from "./helpers/auth";

// A GPX fixture with geometry → the activity gets a PostGIS geom, so its list
// card should render a Leaflet map preview. Guards the batch-geojson query
// (a malformed `ANY(${ids}::text[])` previously threw and was swallowed,
// silently dropping every list preview).
const GPX = "packages/fit/__fixtures__/alpine.gpx";

test.describe("List map previews", () => {
  test("activities list renders a map preview for an activity with geometry", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    await registerUser(page, `lmp-${stamp}@example.com`, `lmp${stamp}`);

    await gotoHydrated(page, "/activities/new");
    await page.getByLabel("Name").fill("Preview check");
    await page.locator('input[name="gpx"]').setInputFiles(GPX);
    await page.getByRole("button", { name: "Create Activity" }).click();
    await expect(page).toHaveURL(/\/activities\/[0-9a-f-]+$/, { timeout: 10000 });

    await gotoHydrated(page, "/activities");
    // The Leaflet container mounts after the client-only dynamic import; no
    // "No map preview" fallback should remain.
    await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("No map preview")).toHaveCount(0);
  });
});
