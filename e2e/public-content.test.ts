import { test, expect, type CDPSession, type Page } from "./fixtures/test";

// Reuses the virtual-authenticator + register helpers from auth.test.ts.
// Inlined rather than factored out to keep this file independently runnable.
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

async function registerUser(page: Page, email: string, username: string) {
  await page.goto("/auth/register");
  await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Register with Passkey/ }).click();
  await expect(page).toHaveURL("/", { timeout: 10000 });
}

async function createRoute(page: Page, name: string): Promise<string> {
  await page.goto("/routes/new");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create Route" }).click();
  await page.waitForURL(/\/routes\/[0-9a-f-]+$/, { timeout: 10000 });
  const url = page.url();
  const id = url.split("/").pop()!;
  return id;
}

async function setRouteVisibility(
  page: Page,
  id: string,
  visibility: "private" | "unlisted" | "public",
) {
  await page.goto(`/routes/${id}/edit`);
  await page.getByLabel("Visibility").selectOption(visibility);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForURL(new RegExp(`/routes/${id}$`), { timeout: 10000 });
}

// New users default to profile_visibility='private' (locked-account
// model). Tests that need an anon visitor to see the profile in full
// have to flip the owner to public first.
//
// The radio is targeted by name+value rather than getByLabel because
// the Private radio's help-text label happens to contain the word
// "public", which trips Playwright's strict-mode match.
async function setProfileVisibilityPublic(page: Page) {
  await page.goto("/settings");
  await page.locator('input[type=radio][name=profileVisibility][value=public]').check();
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  // Don't wait for networkidle — the SSE connection to /api/events
  // (added with notifications) keeps the network in-flight forever.
  // Wait for the explicit save confirmation instead.
  await expect(page.getByText("Profile saved.")).toBeVisible({ timeout: 10000 });
}

// Registration + WebAuthn virtual authenticator can race under parallel
// Playwright workers on a shared local Postgres; run this file serially.
test.describe.configure({ mode: "serial" });

test.describe("Public content visibility", () => {
  test("private route is 404 for a logged-out visitor", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const email = `pcv-priv-${Date.now()}@example.com`;
    const username = `pcvpriv${Date.now()}`;
    await registerUser(page, email, username);
    const id = await createRoute(page, "My private draft");

    // Open a second browser context (no cookies) and try the same URL.
    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const resp = await anon.goto(`/routes/${id}`);
    // Loader throws 404; the response status reflects that.
    expect(resp?.status()).toBe(404);
    await anonCtx.close();
  });

  test("public route is reachable by a logged-out visitor and emits OG tags", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const email = `pcv-pub-${Date.now()}@example.com`;
    const username = `pcvpub${Date.now()}`;
    await registerUser(page, email, username);
    const id = await createRoute(page, "Public ride");
    await setRouteVisibility(page, id, "public");

    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const resp = await anon.goto(`/routes/${id}`);
    expect(resp?.status()).toBe(200);
    await expect(anon.getByRole("heading", { name: "Public ride" })).toBeVisible();

    // OG tags are present in the document head on public pages.
    const ogTitle = await anon.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toContain("Public ride");
    const ogType = await anon.locator('meta[property="og:type"]').getAttribute("content");
    expect(ogType).toBe("article");
    const ogSite = await anon.locator('meta[property="og:site_name"]').getAttribute("content");
    expect(ogSite).toBe("trails.cool");

    await anonCtx.close();
  });

  test("owner can still view their own private content", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const email = `pcv-owner-${Date.now()}@example.com`;
    const username = `pcvowner${Date.now()}`;
    await registerUser(page, email, username);
    const id = await createRoute(page, "My only route");

    // Same session reload: owner still sees it even though default is private.
    await page.goto(`/routes/${id}`);
    await expect(page.getByRole("heading", { name: "My only route" })).toBeVisible();
  });

  test("profile renders private stub when user has no public content (locked model)", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const email = `pcv-empty-${Date.now()}@example.com`;
    const username = `pcvempty${Date.now()}`;
    await registerUser(page, email, username);
    // New users default to profile_visibility='private', so an anonymous
    // visitor sees the locked-account stub (200, not 404). Their private
    // route never appears.
    const id = await createRoute(page, "Private thoughts"); // left private

    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const resp = await anon.goto(`/users/${username}`);
    expect(resp?.status()).toBe(200);
    await expect(anon.getByText(/This profile is private/i)).toBeVisible();
    await expect(anon.getByText("Private thoughts")).not.toBeVisible();
    // Direct route URL still 404s for visitors because the route itself
    // is private-visibility.
    const direct = await anon.goto(`/routes/${id}`);
    expect(direct?.status()).toBe(404);
    await anonCtx.close();
  });

  test("profile renders when user has at least one public route", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const email = `pcv-prof-${Date.now()}@example.com`;
    const username = `pcvprof${Date.now()}`;
    await registerUser(page, email, username);
    await setProfileVisibilityPublic(page);
    const id = await createRoute(page, "Bikepacking loop");
    await setRouteVisibility(page, id, "public");

    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const resp = await anon.goto(`/users/${username}`);
    expect(resp?.status()).toBe(200);

    await expect(anon.getByRole("heading", { name: username })).toBeVisible();
    await expect(anon.getByRole("link", { name: /Bikepacking loop/ })).toBeVisible();
    await anonCtx.close();
  });

  test("unlisted route is reachable by direct URL but does not appear on profile", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const email = `pcv-unl-${Date.now()}@example.com`;
    const username = `pcvunl${Date.now()}`;
    await registerUser(page, email, username);
    await setProfileVisibilityPublic(page);

    // Two routes: one unlisted, one public — profile shows only the public one.
    const publicId = await createRoute(page, "Public one");
    await setRouteVisibility(page, publicId, "public");
    const unlistedId = await createRoute(page, "Unlisted secret");
    await setRouteVisibility(page, unlistedId, "unlisted");

    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();

    // Direct URL to unlisted → 200
    const direct = await anon.goto(`/routes/${unlistedId}`);
    expect(direct?.status()).toBe(200);
    await expect(anon.getByRole("heading", { name: "Unlisted secret" })).toBeVisible();

    // Profile lists only the public route
    await anon.goto(`/users/${username}`);
    await expect(anon.getByRole("link", { name: /Public one/ })).toBeVisible();
    await expect(anon.getByRole("link", { name: /Unlisted secret/ })).not.toBeVisible();

    await anonCtx.close();
  });
});
