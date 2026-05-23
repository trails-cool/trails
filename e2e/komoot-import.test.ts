import { test, expect, waitForHydration, type CDPSession, type Page } from "./fixtures/test";

const KOMOOT_USER_ID = "99999999999";
const KOMOOT_PROFILE_URL = `https://www.komoot.com/user/${KOMOOT_USER_ID}`;

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="komoot" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Morning Hike</name>
    <trkseg>
      <trkpt lat="48.137" lon="11.575"><ele>520</ele></trkpt>
      <trkpt lat="48.138" lon="11.576"><ele>525</ele></trkpt>
      <trkpt lat="48.139" lon="11.577"><ele>530</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const MOCK_TOURS_PAGE = {
  _embedded: {
    tours: [
      {
        id: 111111111,
        name: "Morning Hike",
        type: "hike",
        date: "2024-06-01T08:00:00.000Z",
        distance: 12500,
        duration: 7200,
        elevation_up: 350,
        elevation_down: 350,
      },
    ],
  },
  page: { totalPages: 1, number: 0 },
};

async function setupVirtualAuthenticator(cdp: CDPSession) {
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  return authenticatorId;
}

async function removeVirtualAuthenticator(cdp: CDPSession, authenticatorId: string) {
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  await cdp.send("WebAuthn.disable");
}

async function registerAndLogin(page: Page, cdp: CDPSession) {
  const ts = Date.now();
  const email = `komoot-${ts}@example.com`;
  const username = `komootuser${ts}`;

  await page.goto("/auth/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Register with Passkey/ }).click();
  await expect(page).toHaveURL("/", { timeout: 10000 });

  return { email, username };
}

function mockKomootPublicProfile(page: Page, userId: string, trailsProfileUrl: string) {
  return page.route(`https://api.komoot.de/v007/users/${userId}/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: userId,
        display_name: "Test Komoot User",
        content: {
          text: `Check out my trails profile: ${trailsProfileUrl}`,
          link: null,
        },
      }),
    }),
  );
}

function mockKomootPublicProfileNoMatch(page: Page, userId: string) {
  return page.route(`https://api.komoot.de/v007/users/${userId}/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: userId,
        display_name: "Test Komoot User",
        content: { text: "I like hiking", link: null },
      }),
    }),
  );
}

function mockKomootTours(page: Page, userId: string) {
  return page.route(
    (url) => url.href.includes(`api.komoot.de/v007/users/${userId}/tours`),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TOURS_PAGE),
      }),
  );
}

function mockKomootGpx(page: Page, tourId: string) {
  return page.route(
    (url) => url.href.includes(`api.komoot.de/v007/tours/${tourId}.gpx`),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/gpx+xml",
        body: SAMPLE_GPX,
      }),
  );
}

test.describe("Komoot connection page", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/settings/connections/komoot");
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });

  test("public verify — success path", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerAndLogin(page, cdp);

    const trailsProfileUrl = `http://localhost:3000/users/${username}`;
    await mockKomootPublicProfile(page, KOMOOT_USER_ID, trailsProfileUrl);

    await page.goto("/settings/connections/komoot");
    await waitForHydration(page);

    await page.getByLabel("Komoot profile URL or user ID").fill(KOMOOT_PROFILE_URL);
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByRole("status")).toContainText("connected in public mode", {
      timeout: 10000,
    });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("public verify — bio does not contain profile URL shows error", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    await mockKomootPublicProfileNoMatch(page, KOMOOT_USER_ID);

    await page.goto("/settings/connections/komoot");
    await waitForHydration(page);

    await page.getByLabel("Komoot profile URL or user ID").fill(KOMOOT_PROFILE_URL);
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByRole("alert")).toContainText("Could not verify", { timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("public verify — invalid URL shows error", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    await page.goto("/settings/connections/komoot");
    await waitForHydration(page);

    await page.getByLabel("Komoot profile URL or user ID").fill("not-a-valid-url");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByRole("alert")).toContainText("valid Komoot", { timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("authenticated connect — invalid credentials shows error", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    // Mock Komoot auth endpoint to reject
    await page.route(/api\.komoot\.de\/v006\/account\/email/, (route) =>
      route.fulfill({ status: 401, body: "Unauthorized" }),
    );

    await page.goto("/settings/connections/komoot");
    await waitForHydration(page);

    await page.getByLabel("Komoot email").fill("wrong@example.com");
    await page.getByLabel("Komoot password").fill("wrongpassword");
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid Komoot", { timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });
});

test.describe("Komoot import page", () => {
  test("shows importable public tours after public verify", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerAndLogin(page, cdp);

    const trailsProfileUrl = `http://localhost:3000/users/${username}`;
    await mockKomootPublicProfile(page, KOMOOT_USER_ID, trailsProfileUrl);
    await mockKomootTours(page, KOMOOT_USER_ID);
    await mockKomootGpx(page, "111111111");

    // Connect first
    await page.goto("/settings/connections/komoot");
    await waitForHydration(page);
    await page.getByLabel("Komoot profile URL or user ID").fill(KOMOOT_PROFILE_URL);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("status")).toContainText("connected in public mode", {
      timeout: 10000,
    });

    // Navigate to import page
    await page.goto("/sync/import/komoot");
    await expect(page.getByText("Morning Hike")).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("import tour creates a route", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerAndLogin(page, cdp);

    const trailsProfileUrl = `http://localhost:3000/users/${username}`;
    await mockKomootPublicProfile(page, KOMOOT_USER_ID, trailsProfileUrl);
    await mockKomootTours(page, KOMOOT_USER_ID);
    await mockKomootGpx(page, "111111111");

    // Connect
    await page.goto("/settings/connections/komoot");
    await waitForHydration(page);
    await page.getByLabel("Komoot profile URL or user ID").fill(KOMOOT_PROFILE_URL);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("status")).toContainText("connected in public mode", {
      timeout: 10000,
    });

    // Import
    await page.goto("/sync/import/komoot");
    await expect(page.getByText("Morning Hike")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByText("Imported")).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });
});
