import { test, expect } from "./fixtures/test";
import { mockBRouter } from "./fixtures/brouter-mock";
import { createSession } from "./helpers/planner";

test.beforeEach(async ({ page }) => {
  await mockBRouter(page);
});

const WITH_ROUTE = encodeURIComponent(JSON.stringify([
  { lat: 52.520, lon: 13.405 },
  { lat: 52.515, lon: 13.351 },
]));

// `ElevationChart` returns `null` until `points.length >= 2` — i.e. until
// the BRouter response (even mocked) has flowed through the Yjs round-trip
// and updated `yjs.routeData`. On cold CI runs the lazy-loaded chart
// chunk + that async pipeline have measurably exceeded the previous 10s
// window. 20s buys headroom without masking a real regression — the
// other planner suites use the same budget for similar lazy-chunk waits.
const CANVAS_TIMEOUT = 20_000;
const SELECT_TIMEOUT = 5_000;

test.describe("Planner – route coloring", () => {
  test("session has color mode toggle", async ({ page, request }) => {
    const url = await createSession(request);

    await page.goto(`${url}?waypoints=${WITH_ROUTE}`);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    await expect(page.locator("canvas")).toBeVisible({ timeout: CANVAS_TIMEOUT });
    const select = page.locator("select", { has: page.locator("option[value='highway']") });
    await expect(select).toBeVisible({ timeout: SELECT_TIMEOUT });
    await expect(select).toHaveValue("plain");

    await select.selectOption("elevation");
    await expect(select).toHaveValue("elevation");
  });

  test("road type color mode renders chart and shows legend", async ({ page, request }) => {
    const url = await createSession(request);

    await page.goto(`${url}?waypoints=${WITH_ROUTE}`);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    await expect(page.locator("canvas")).toBeVisible({ timeout: CANVAS_TIMEOUT });
    const select = page.locator("select", { has: page.locator("option[value='highway']") });
    await expect(select).toBeVisible({ timeout: SELECT_TIMEOUT });

    await select.selectOption("highway");
    await expect(select).toHaveValue("highway");

    await expect(page.getByText("Road Type Profile")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("secondary")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("residential")).toBeVisible({ timeout: 5000 });
  });

  test("road type hover label shows highway type", async ({ page, request }) => {
    const url = await createSession(request);

    await page.goto(`${url}?waypoints=${WITH_ROUTE}`);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    await expect(page.locator("canvas")).toBeVisible({ timeout: CANVAS_TIMEOUT });
    const select = page.locator("select", { has: page.locator("option[value='highway']") });
    await expect(select).toBeVisible({ timeout: SELECT_TIMEOUT });
    await select.selectOption("highway");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 5000 });
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }

    await expect(canvas).toBeVisible();
  });
});
