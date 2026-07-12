import { test, expect } from "./fixtures/test";
import { createSession } from "./helpers/planner";

test.describe("Planner – overlays", () => {
  test("enable hillshading overlay loads tiles", async ({ page, request }) => {
    const url = await createSession(request);

    const hillshadingRequests: string[] = [];
    await page.route("**/tiles.wmflabs.org/hillshading/**", async (route) => {
      hillshadingRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEFTuQmCC", "base64"),
      });
    });

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(".leaflet-control-layers-overlays input");
      if (inputs[0]) inputs[0].click();
    });

    await page.waitForTimeout(2000);
    expect(hillshadingRequests.length).toBeGreaterThan(0);
  });

  test("enable POI category shows markers on map", async ({ page, request }) => {
    const url = await createSession(request);

    await page.route("**/api/pois*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          pois: [
            {
              id: 12345,
              lat: 52.52,
              lon: 13.405,
              name: "Test Brunnen",
              category: "drinking_water",
              tags: { amenity: "drinking_water", name: "Test Brunnen" },
            },
          ],
        }),
      });
    });

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      const map = (window as any).__leafletMap;
      if (map) map.setView([52.52, 13.405], 14, { animate: false });
    });
    await page.waitForTimeout(500);

    await page.getByTitle("Points of Interest").click();
    await page.getByText("Drinking water").click();

    await page.waitForTimeout(3000);

    const markerCount = await page.locator(".leaflet-marker-pane .leaflet-marker-icon").count();
    expect(markerCount).toBeGreaterThan(0);

    const panelText = await page.getByText("Drinking water").textContent();
    expect(panelText).toBeTruthy();
  });
});
