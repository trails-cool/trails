import { test, expect } from "./fixtures/test";
import { mockBRouter, latLngToPixel } from "./fixtures/brouter-mock";
import { createSession, openSession } from "./helpers/planner";

test.beforeEach(async ({ page }) => {
  await mockBRouter(page);
});

test.describe("Planner – routing", () => {
  test("clicking on route splits it by inserting a waypoint", async ({ page, request }) => {
    const url = await createSession(request);

    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify([
      { lat: 52.520, lon: 13.405 },
      { lat: 52.515, lon: 13.351 },
    ]))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Waypoints (2)")).toBeVisible({ timeout: 5000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText(/\d+\.\d+ km/).first()).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const map = (window as any).__leafletMap;
      if (!map) return;
      map.setView([52.518, 13.383], 15, { animate: false });
    });
    await page.waitForTimeout(500);

    const pixel = await latLngToPixel(page, 52.518, 13.383);
    await page.mouse.click(pixel.x, pixel.y);

    await expect(page.getByText("Waypoints (3)")).toBeVisible({ timeout: 10000 });
  });

  test("map zooms to fit the route when opened with initial waypoints", async ({ page, request }) => {
    const url = await createSession(request);

    const waypoints = [
      { lat: 52.520, lon: 13.405 },
      { lat: 52.515, lon: 13.351 },
    ];
    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText(/\d+\.\d+ km/).first()).toBeVisible({ timeout: 10000 });

    const zoom = await page.evaluate(() => {
      const map = (window as any).__leafletMap;
      return map ? map.getZoom() : null;
    });
    expect(zoom).not.toBeNull();
    expect(zoom).toBeGreaterThan(6);
  });

  test("waypoint note roundtrips through GPX import and export", async ({ page, request }) => {
    const url = await createSession(request);

    const gpxWithNote = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.52" lon="13.405"><name>Berlin</name><desc>Refill water here</desc></wpt>
  <wpt lat="52.515" lon="13.351"><name>Spandau</name></wpt>
  <trk><trkseg>
    <trkpt lat="52.520" lon="13.405"><ele>34</ele></trkpt>
    <trkpt lat="52.515" lon="13.351"><ele>40</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    await openSession(page, url);

    const dataTransfer = await page.evaluateHandle((content) => {
      const dt = new DataTransfer();
      const file = new File([content], "noted.gpx", { type: "application/gpx+xml" });
      dt.items.add(file);
      return dt;
    }, gpxWithNote);

    const map = page.locator(".leaflet-container");
    await map.dispatchEvent("dragenter", { dataTransfer });
    await page.getByText("Drop GPX file here").waitFor({ timeout: 3000 });
    page.on("dialog", (dialog) => dialog.accept());
    await map.dispatchEvent("drop", { dataTransfer });

    await expect(page.getByText("Waypoints (2)")).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Refill water here")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "▾" }).click();
    await expect(page.getByText("Export Plan")).toBeVisible({ timeout: 3000 });
    const downloadPromise = page.waitForEvent("download");
    await page.getByText("Export Plan").first().click();
    const download = await downloadPromise;
    const gpxStream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of gpxStream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const gpxText = Buffer.concat(chunks).toString("utf-8");

    expect(gpxText).toContain("<desc>Refill water here</desc>");
    expect(gpxText.indexOf("<wpt")).toBeLessThan(gpxText.indexOf("<desc>Refill water here</desc>"));
  });

  test("nearby POI snap moves waypoint and prepends note prefix", async ({ page, request }) => {
    const url = await createSession(request);

    await page.route("**/api/overpass", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          elements: [
            {
              type: "node",
              id: 99001,
              lat: 52.521,
              lon: 13.406,
              tags: { amenity: "drinking_water", name: "Stadtbrunnen" },
            },
          ],
        }),
      });
    });

    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify([
      { lat: 52.520, lon: 13.405, name: "Start" },
      { lat: 52.515, lon: 13.351, name: "End" },
    ]))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Waypoints (2)")).toBeVisible({ timeout: 5000 });

    const sidebar = page.locator("aside");

    const firstRow = sidebar.locator("li").filter({ has: page.locator("span.rounded-full").first() }).first();
    await firstRow.click();

    await expect(sidebar.getByText("Nearby")).toBeVisible({ timeout: 5000 });
    await expect(sidebar.getByText("Stadtbrunnen")).toBeVisible({ timeout: 5000 });

    const snapButton = sidebar.locator("li").filter({ hasText: "Stadtbrunnen" }).getByRole("button", { name: /snap/i });
    await snapButton.click();

    await expect(firstRow.locator("p.italic")).not.toHaveText(/Add a note/);
    const noteText = await firstRow.locator("p.italic").textContent();
    expect(noteText).toContain("Stadtbrunnen");
  });
});
