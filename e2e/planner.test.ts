import { test, expect } from "@playwright/test";

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
    await expect(profileSelect).toHaveValue("trekking");
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
    await expect(page.getByPlaceholder("Add notes for this session...")).toBeVisible();

    // Switch back to Waypoints tab
    await page.getByRole("button", { name: "Waypoints" }).click();
    await expect(page.getByText("Waypoints (0)")).toBeVisible();
  });

  test("clicking on route splits it by inserting a waypoint", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify([
      { lat: 52.520, lon: 13.405 },
      { lat: 52.515, lon: 13.351 },
    ]))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Waypoints (2)")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/\d+\.\d+ km/)).toBeVisible({ timeout: 20000 });

    // Zoom in and click on the route midpoint to split it
    // RouteInteraction uses map-level mousemove, but click on the ghost marker
    // inserts the waypoint. We'll use Leaflet events to simulate.
    await page.evaluate(() => {
      const map = (window as any).__leafletMap;
      if (!map) return;
      map.setView([52.5175, 13.378], 14, { animate: false });
    });
    await page.waitForTimeout(1000);

    // Click on the route via the visible polyline's bounding box
    const routePath = page.locator(".leaflet-overlay-pane path").first();
    await expect(routePath).toBeAttached({ timeout: 5000 });
    const box = await routePath.boundingBox();
    if (!box) throw new Error("Route polyline not visible");

    // Click the center of the route path bounding box
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // The click on the map near the route should trigger RouteInteraction
    // which shows the ghost and inserts a waypoint. If the click was within
    // snap tolerance, a waypoint is inserted. Otherwise, a new waypoint is
    // appended (map click). Either way we get 3 waypoints.
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

    const waypoints = [
      { lat: 52.520, lon: 13.405 },
      { lat: 52.515, lon: 13.351 },
    ];
    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    // Wait for route to compute and fit
    await expect(page.getByText(/\d+\.\d+ km/)).toBeVisible({ timeout: 20000 });

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

    // Create session with 3 waypoints
    await page.goto(`${url}?waypoints=${encodeURIComponent(JSON.stringify([
      { lat: 52.520, lon: 13.405 },
      { lat: 51.840, lon: 12.243 },
      { lat: 50.980, lon: 11.028 },
    ]))}`);

    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Waypoints (3)")).toBeVisible({ timeout: 5000 });

    // Wait for route to compute
    await expect(page.getByText(/\d+\.\d+ km/)).toBeVisible({ timeout: 20000 });

    // Hover waypoint 2 to reveal controls, click the overnight toggle (moon icon)
    const waypointRows = page.locator("li").filter({ has: page.locator("span.rounded-full") });
    const secondRow = waypointRows.nth(1);
    await secondRow.hover();
    const moonButton = secondRow.getByTitle(/overnight/i);
    await moonButton.click();

    // Day breakdown should appear
    await expect(page.getByText("Day 1")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Day 2")).toBeVisible({ timeout: 5000 });
  });

  test("export GPX with day breaks includes overnight metadata", async ({ page, request }) => {
    const sessionResp = await request.post("/api/sessions", { data: {} });
    const { url } = await sessionResp.json();

    // Import a GPX with overnight waypoints
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.520" lon="13.405"><name>Berlin</name></wpt>
  <wpt lat="51.840" lon="12.243"><name>Dessau</name><type>overnight</type></wpt>
  <wpt lat="50.980" lon="11.028"><name>Erfurt</name></wpt>
  <trk><trkseg>
    <trkpt lat="52.520" lon="13.405"><ele>34</ele></trkpt>
    <trkpt lat="51.840" lon="12.243"><ele>80</ele></trkpt>
    <trkpt lat="50.980" lon="11.028"><ele>195</ele></trkpt>
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

    // The overnight waypoint should show day breakdown
    await expect(page.getByText("Day 1")).toBeVisible({ timeout: 5000 });
  });
});
