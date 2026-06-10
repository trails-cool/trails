// End-to-end coverage for the journal → planner → journal save flow,
// added together with #2 Phase A (#442) + Phase B (#443).
//
// What this test guarantees:
//   1. Clicking Save-to-Journal in the planner UI successfully POSTs
//      back to the journal via the server-side proxy (#442) — i.e. the
//      callback JWT never appears in the browser.
//   2. The journal's callback enforces single-use jti (#443) — a
//      second save with the same session/token returns an error.
//
// The test bypasses the journal UI's "Edit in Planner" button (which
// would need a logged-in user with a route + GPX). Instead it uses the
// `/api/e2e/seed` endpoint to mint a routeId + JWT, POSTs to the
// planner's `/api/sessions` with callbackUrl + callbackToken — exactly
// what `api.routes.$id.edit-in-planner` does server-to-server — and
// then opens the session URL with waypoint params so the planner
// computes a route and the Save button has GPX to ship.

import { test, expect } from "./fixtures/test";
import { JOURNAL, PLANNER, seedRoute, routeHasGeom } from "./helpers/journal";
import { mockBRouter } from "./fixtures/brouter-mock";


// Mock BRouter so the in-browser route compute is deterministic and
// fast — same approach as `planner-coloring.test.ts`. Without this the
// test would block on a real BRouter cold-start.
test.beforeEach(async ({ page }) => {
  await mockBRouter(page);
});

const WAYPOINTS = encodeURIComponent(JSON.stringify([
  { lat: 52.520, lon: 13.405 },
  { lat: 52.515, lon: 13.351 },
]));

async function seedRouteAndPlannerSession(request: import("@playwright/test").APIRequestContext) {
  const { routeId, token } = await seedRoute(request);

  // Create a planner session with the journal callback wired up — no
  // GPX seeded into the session itself. We pass waypoints via URL
  // below so the in-browser Yjs doc gets them and requestRoute fires.
  const sessionResp = await request.post(`${PLANNER}/api/sessions`, {
    data: {
      callbackUrl: `${JOURNAL}/api/routes/${routeId}/callback`,
      callbackToken: token,
    },
  });
  expect(sessionResp.ok()).toBeTruthy();
  const session = (await sessionResp.json()) as { sessionId: string; url: string };
  const sessionPageUrl = `${PLANNER}${session.url}?waypoints=${WAYPOINTS}`;
  return { routeId, token, sessionPageUrl };
}

test.describe("Journal ↔ Planner save handoff (Phase A + B)", () => {
  test("planner save POSTs back to journal — token stays server-side", async ({ page, request }) => {
    const { routeId, token, sessionPageUrl } = await seedRouteAndPlannerSession(request);

    // Capture every browser-originated request so we can assert the
    // specific token string never appears in any of them.
    const observed: string[] = [];
    page.on("request", (req) => {
      const body = req.postData();
      if (body) observed.push(body);
      const auth = req.headers()["authorization"];
      if (auth) observed.push(`AUTH:${auth}`);
    });

    await page.goto(sessionPageUrl);
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    // Wait for the route to actually compute — the elevation chart
    // canvas mounts once `routeData` has points, which is the same
    // condition that gates a non-empty GPX in the Save handler.
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20000 });

    const saveBtn = page.getByRole("button", { name: /Save to Journal/i });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await saveBtn.click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 15000 });

    // The browser must never have seen the JWT.
    expect(observed.some((s) => s.includes(token))).toBe(false);

    // Sanity: the journal's route now has geometry.
    expect(await routeHasGeom(request, routeId)).toBe(true);
  });

  test("token is single-use — second save through the planner UI fails", async ({ page, request }) => {
    const { sessionPageUrl } = await seedRouteAndPlannerSession(request);

    await page.goto(sessionPageUrl);
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20000 });

    const saveBtn = page.getByRole("button", { name: /Save to Journal/i });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });

    // First click consumes the token.
    await saveBtn.click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 15000 });

    // Second click reuses the same session's stored JWT. The journal's
    // verifier rejects on jti conflict (#443); the planner proxy
    // forwards the error to the UI.
    await saveBtn.click();
    await expect(page.getByText(/consumed|already|fail/i)).toBeVisible({ timeout: 15000 });
  });
});
