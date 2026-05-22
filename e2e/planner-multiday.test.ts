import { test, expect } from "./fixtures/test";
import { mockBRouter } from "./fixtures/brouter-mock";
import { createSession, openSession } from "./helpers/planner";

test.beforeEach(async ({ page }) => {
  await mockBRouter(page);
});

test.describe("Planner – multi-day routes", () => {
  test("toggle overnight on waypoint shows day breakdown in sidebar", async ({ page, request }) => {
    const url = await createSession(request);

    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify([
      { lat: 52.520, lon: 13.405 },
      { lat: 52.516, lon: 13.377 },
      { lat: 52.510, lon: 13.390 },
    ]))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Waypoints (3)")).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText(/\d+\.\d+ km/).first()).toBeVisible({ timeout: 15000 });

    const waypointRows = sidebar.locator("li").filter({ has: page.locator("span.rounded-full") });
    const secondRow = waypointRows.nth(1);
    await secondRow.hover();
    const moonButton = secondRow.getByTitle(/overnight/i);
    await moonButton.click();

    await expect(sidebar.getByText("Day 1")).toBeVisible({ timeout: 5000 });
    await expect(sidebar.getByText("Day 2")).toBeVisible({ timeout: 5000 });
  });

  test("export GPX with day breaks includes overnight metadata", async ({ page, request }) => {
    const url = await createSession(request);

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.520" lon="13.405"><name>Berlin</name></wpt>
  <wpt lat="52.516" lon="13.377"><name>Mitte</name><type>overnight</type></wpt>
  <wpt lat="52.510" lon="13.390"><name>Kreuzberg</name></wpt>
  <trk><trkseg>
    <trkpt lat="52.520" lon="13.405"><ele>34</ele></trkpt>
    <trkpt lat="52.516" lon="13.377"><ele>40</ele></trkpt>
    <trkpt lat="52.510" lon="13.390"><ele>35</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    await openSession(page, url);

    const dataTransfer = await page.evaluateHandle((content) => {
      const dt = new DataTransfer();
      const file = new File([content], "multi-day.gpx", { type: "application/gpx+xml" });
      dt.items.add(file);
      return dt;
    }, gpx);

    const map = page.locator(".leaflet-container");
    await map.dispatchEvent("dragenter", { dataTransfer });
    await page.getByText("Drop GPX file here").waitFor({ timeout: 3000 });
    page.on("dialog", (dialog) => dialog.accept());
    await map.dispatchEvent("drop", { dataTransfer });

    await expect(page.getByText("Waypoints (3)")).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Day 1")).toBeVisible({ timeout: 5000 });
  });
});
