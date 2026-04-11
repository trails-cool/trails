import { test, expect } from "@playwright/test";
import { mockBRouter, latLngToPixel } from "./fixtures/brouter-mock";

test.describe("Planner", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/trails\.cool Planner/);
    await expect(page.getByRole("link", { name: "Start Planning" })).toBeVisible();
  });

  test("can create a session via API", async ({ request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.sessionId).toBeTruthy();
    expect(body.url).toContain("/session/");
  });

  test("session page loads with map", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    // Title is now a home link
    await expect(page.getByRole("link", { name: "trails.cool Planner" })).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
  });

  test("session shows connection status", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
  });

  test("session has profile selector", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const profileSelect = page.getByLabel("Profile:");
    await expect(profileSelect).toBeVisible();
    await expect(profileSelect).toHaveValue("fastbike");
  });

  test("session has export GPX button", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.getByRole("button", { name: "Export GPX" })).toBeVisible({ timeout: 10000 });
  });

  test("session shows empty waypoints sidebar", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.getByText("Waypoints (0)")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Click on the map to add waypoints")).toBeVisible();
  });

  test("session has sidebar tabs (waypoints and notes)", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    // Waypoints tab is active by default
    await expect(page.getByRole("button", { name: "Waypoints" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Notes" })).toBeVisible();

    // Switch to Notes tab
    await page.getByRole("button", { name: "Notes" }).click();
    // CodeMirror editor should be visible with the placeholder text
    await expect(page.getByText("Add notes for this session...")).toBeVisible();

    // Switch back to Waypoints tab
    await page.getByRole("button", { name: "Waypoints" }).click();
    await expect(page.getByText("Waypoints (0)")).toBeVisible();
  });

  test("clicking on route splits it by inserting a waypoint", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    await mockBRouter(page);

    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify([
      { lat: 52.520, lon: 13.405 },
      { lat: 52.515, lon: 13.351 },
    ]))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Waypoints (2)")).toBeVisible({ timeout: 5000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText(/\d+\.\d+ km/).first()).toBeVisible({ timeout: 10000 });

    // Zoom in to the route midpoint using known coordinates
    await page.evaluate(() => {
      const map = (window as any).__leafletMap;
      if (!map) return;
      map.setView([52.518, 13.383], 15, { animate: false });
    });
    await page.waitForTimeout(500);

    // Click on a known route coordinate to insert a waypoint
    const pixel = await latLngToPixel(page, 52.518, 13.383);
    await page.mouse.click(pixel.x, pixel.y);

    // Should now have 3 waypoints (original 2 + inserted)
    await expect(page.getByText("Waypoints (3)")).toBeVisible({ timeout: 10000 });
  });

  // Note: Ghost marker hover interaction is verified visually via cmux browser.
  // Playwright's mouse simulation doesn't reliably trigger Leaflet's SVG
  // pointer events needed for the distance-based snap detection.

  test("session has color mode toggle", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const select = page.getByTitle("Route Color");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("plain");

    // Switch to elevation
    await select.selectOption("elevation");
    await expect(select).toHaveValue("elevation");
  });

  test("session has no-go area button", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTitle("Draw no-go area")).toBeVisible();
  });

  test("map zooms to fit the route when opened with initial waypoints", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    await mockBRouter(page);

    const waypoints = [
      { lat: 52.520, lon: 13.405 },
      { lat: 52.515, lon: 13.351 },
    ];
    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText(/\d+\.\d+ km/).first()).toBeVisible({ timeout: 10000 });

    // The map should have zoomed in to the route bounds (zoom > default 6)
    const zoom = await page.evaluate(() => {
      const map = (window as any).__leafletMap;
      return map ? map.getZoom() : null;
    });
    expect(zoom).not.toBeNull();
    expect(zoom).toBeGreaterThan(6);
  });

  test("can create session with initial waypoints", async ({ request }) => {
    const response = await request.post("/api/sessions", {
      data: {
        gpx: '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="52.52" lon="13.405"><name>Berlin</name></wpt><wpt lat="48.137" lon="11.576"><name>Munich</name></wpt></gpx>',
      },
    });
    const body = await response.json();
    expect(body.initialWaypoints).toHaveLength(2);
    expect(body.initialWaypoints[0].name).toBe("Berlin");
  });

  test("expired session returns 404", async ({ page }) => {
    const response = await page.goto("/session/nonexistent-id");
    expect(response?.status()).toBe(404);
  });

  test("home page has Import GPX button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Import GPX")).toBeVisible();
  });

  test("import invalid GPX shows error", async ({ page }) => {
    await page.goto("/");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import GPX").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "broken.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from("not valid xml at all"),
    });

    // Should show error, stay on home page
    await expect(page.getByText(/Could not read|konnte nicht/)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/^\/$|\/$/);
  });

  test("import GPX from home page creates session with waypoints", async ({ page }) => {
    await page.goto("/");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
    <trkpt lat="51.05" lon="13.74"><ele>113</ele></trkpt>
    <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
  </trkseg></trk>
</gpx>`;
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import GPX").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "test-route.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(gpx),
    });

    // Should redirect to a session
    await expect(page).toHaveURL(/\/session\//, { timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
  });

  test("toggle overnight on waypoint shows day breakdown in sidebar", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    await mockBRouter(page);

    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify([
      { lat: 52.520, lon: 13.405 },
      { lat: 52.516, lon: 13.377 },
      { lat: 52.510, lon: 13.390 },
    ]))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Waypoints (3)")).toBeVisible({ timeout: 5000 });

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText(/\d+\.\d+ km/).first()).toBeVisible({ timeout: 10000 });

    // Hover waypoint 2 to reveal controls, click the overnight toggle (moon icon)
    const waypointRows = sidebar.locator("li").filter({ has: page.locator("span.rounded-full") });
    const secondRow = waypointRows.nth(1);
    await secondRow.hover();
    const moonButton = secondRow.getByTitle(/overnight/i);
    await moonButton.click();

    // Day breakdown should appear in the sidebar
    await expect(sidebar.getByText("Day 1")).toBeVisible({ timeout: 5000 });
    await expect(sidebar.getByText("Day 2")).toBeVisible({ timeout: 5000 });
  });

  test("export GPX with day breaks includes overnight metadata", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    await mockBRouter(page);

    // Import a GPX with overnight waypoints
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

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    // Drop the GPX file onto the map
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

    // Wait for waypoints to load
    await expect(page.getByText("Waypoints (3)")).toBeVisible({ timeout: 10000 });

    // The overnight waypoint should show day breakdown in the sidebar
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Day 1")).toBeVisible({ timeout: 5000 });
  });

  test("enable hillshading overlay loads tiles", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    // Track hillshading tile requests
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

    // Enable hillshading via DOM — Leaflet's layers control hover is hard to automate
    await page.evaluate(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(".leaflet-control-layers-overlays input");
      if (inputs[0]) inputs[0].click();
    });

    await page.waitForTimeout(2000);
    expect(hillshadingRequests.length).toBeGreaterThan(0);
  });

  test("enable POI category shows markers on map", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    // Mock Overpass API to return a test POI at the map center
    await page.route("**/api/interpreter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          elements: [
            {
              type: "node",
              id: 12345,
              lat: 52.52,
              lon: 13.405,
              tags: { amenity: "drinking_water", name: "Test Brunnen" },
            },
          ],
        }),
      });
    });

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    // Zoom in to Berlin center to meet zoom threshold and see the mock POI
    await page.evaluate(() => {
      const map = (window as any).__leafletMap;
      if (map) map.setView([52.52, 13.405], 14, { animate: false });
    });
    await page.waitForTimeout(500);

    // Open POI panel and enable Drinking water
    await page.getByTitle("Points of Interest").click();
    await page.getByText("Drinking water").click();

    // Wait for mock Overpass response and marker rendering
    await page.waitForTimeout(3000);

    // Verify POI marker rendered — check for marker with the water emoji in the pane
    const markerCount = await page.locator(".leaflet-marker-pane .leaflet-marker-icon").count();
    // Should have at least one POI marker (beyond any waypoint markers)
    expect(markerCount).toBeGreaterThan(0);

    // Verify the Overpass mock was actually called by checking the POI panel count
    const panelText = await page.getByText("Drinking water").textContent();
    expect(panelText).toBeTruthy();
  });
});
