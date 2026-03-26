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

  test("session has no-go area button", async ({ page, request }) => {
    const response = await request.post("/api/sessions", { data: {} });
    const { url } = await response.json();

    await page.goto(url);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTitle("Draw no-go area")).toBeVisible();
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
});
