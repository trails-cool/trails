// End-to-end coverage for the journal → planner → journal save flow,
// added together with #2 Phase A (#442) + Phase B (#443).
//
// What this test guarantees:
//   1. Clicking Save-to-Journal in the planner UI successfully POSTs
//      back to the journal via the server-side proxy (#442) — i.e. the
//      callback JWT never appears in the browser.
//   2. The journal's callback enforces single-use jti (#443) — a
//      second save with the same session/token returns 401.
//
// The test bypasses the journal UI's "Edit in Planner" button (which
// would need a logged-in user with a route + GPX). Instead it uses the
// `/api/e2e/seed` endpoint to mint a routeId + JWT, then directly POSTs
// to the planner's `/api/sessions` with callbackUrl + callbackToken —
// exactly the call that `api.routes.$id.edit-in-planner` makes
// server-to-server. From that point on it's the same flow as a real
// user.

import { test, expect } from "./fixtures/test";

const JOURNAL = "http://localhost:3000";
const PLANNER = "http://localhost:3001";

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
    <trkpt lat="52.51" lon="13.38"><ele>40</ele></trkpt>
    <trkpt lat="52.50" lon="13.35"><ele>35</ele></trkpt>
  </trkseg></trk>
</gpx>`;

async function seedRouteAndPlannerSession(request: import("@playwright/test").APIRequestContext) {
  const seedResp = await request.post(`${JOURNAL}/api/e2e/seed`);
  expect(seedResp.ok()).toBeTruthy();
  const { routeId, token } = (await seedResp.json()) as { routeId: string; token: string };

  const sessionResp = await request.post(`${PLANNER}/api/sessions`, {
    data: {
      callbackUrl: `${JOURNAL}/api/routes/${routeId}/callback`,
      callbackToken: token,
      gpx: VALID_GPX,
    },
  });
  expect(sessionResp.ok()).toBeTruthy();
  const session = (await sessionResp.json()) as {
    sessionId: string;
    url: string;
    initialWaypoints?: unknown[];
  };
  return { routeId, token, session };
}

test.describe("Journal ↔ Planner save handoff (Phase A + B)", () => {
  test("planner save POSTs back to journal — token stays server-side", async ({ page, request }) => {
    const { routeId, token, session } = await seedRouteAndPlannerSession(request);

    // Capture every browser-originated request so we can assert the
    // specific token string never appears in any of them — neither in
    // an Authorization header nor in a request body. The planner's
    // server-side proxy is the only thing that should see it.
    const observed: string[] = [];
    page.on("request", (req) => {
      const body = req.postData();
      if (body) observed.push(body);
      const auth = req.headers()["authorization"];
      if (auth) observed.push(`AUTH:${auth}`);
    });

    await page.goto(`${PLANNER}${session.url}`);
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    const saveBtn = page.getByRole("button", { name: /Save/i });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await saveBtn.click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 15000 });

    expect(observed.some((s) => s.includes(token))).toBe(false);

    // Sanity: the journal's route now has geometry.
    const geomResp = await request.get(`${JOURNAL}/api/e2e/route/${routeId}`);
    const { hasGeom } = (await geomResp.json()) as { hasGeom: boolean };
    expect(hasGeom).toBe(true);
  });

  test("token is single-use — second save through the planner UI fails", async ({ page, request }) => {
    const { session } = await seedRouteAndPlannerSession(request);

    await page.goto(`${PLANNER}${session.url}`);
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 15000 });

    const saveBtn = page.getByRole("button", { name: /Save/i });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });

    // First click consumes the token.
    await saveBtn.click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 15000 });

    // Second click reuses the same session's stored JWT — the journal
    // verifier should reject it on jti conflict (#443). The planner
    // proxy forwards the journal's error to the UI.
    //
    // The UI keeps the "Saved" indicator visible after the first
    // success; clicking the button a second time should swap it for an
    // error message. We assert either a visible error or the absence
    // of a second "Saved" (the component only flips the saved state on
    // a success response).
    await saveBtn.click();
    await expect(page.getByText(/consumed|already|fail/i)).toBeVisible({ timeout: 15000 });
  });
});
