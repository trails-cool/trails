import { test, expect } from "./fixtures/test";
import { createSession, openSession } from "./helpers/planner";

test.describe("Planner – session", () => {
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
    const url = await createSession(request);
    await page.goto(url);
    await expect(page.getByRole("link", { name: "trails.cool Planner" })).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
  });

  test("session shows connection status", async ({ page, request }) => {
    const url = await createSession(request);
    await page.goto(url);
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
  });

  test("session has profile selector", async ({ page, request }) => {
    const url = await createSession(request);
    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    const profileSelect = page.getByLabel("Profile:");
    await expect(profileSelect).toBeVisible();
    await expect(profileSelect).toHaveValue("fastbike");
  });

  test("session has export GPX button", async ({ page, request }) => {
    const url = await createSession(request);
    await page.goto(url);
    await expect(page.getByRole("button", { name: "Export GPX" })).toBeVisible({ timeout: 10000 });
  });

  test("session shows empty waypoints sidebar", async ({ page, request }) => {
    const url = await createSession(request);
    await page.goto(url);
    await expect(page.getByText("Waypoints (0)")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Click on the map to add waypoints")).toBeVisible();
  });

  test("session has sidebar tabs (waypoints and notes)", async ({ page, request }) => {
    const url = await createSession(request);
    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("button", { name: "Waypoints" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Notes" })).toBeVisible();

    await page.getByRole("button", { name: "Notes" }).click();
    await expect(page.getByText("Add notes for this session...")).toBeVisible();

    await page.getByRole("button", { name: "Waypoints" }).click();
    await expect(page.getByText("Waypoints (0)")).toBeVisible();
  });

  test("session has no-go area button", async ({ page, request }) => {
    const url = await createSession(request);
    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTitle("Draw no-go area")).toBeVisible();
  });

  test("can create session with initial waypoints via API", async ({ request }) => {
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
    await expect(page).toHaveURL(/\/session\//, { timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
  });
});
