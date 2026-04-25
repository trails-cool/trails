import { test, expect, type CDPSession, type Page } from "./fixtures/test";

// Inline virtual-authenticator + register helpers, mirroring the pattern
// in auth.test.ts / public-content.test.ts so this file runs standalone.
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

async function setProfileVisibility(page: Page, value: "public" | "private") {
  await page.goto("/settings");
  if (value === "public") {
    await page.getByLabel("Public").check();
  } else {
    await page.getByLabel(/Private/).check();
  }
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await page.waitForLoadState("networkidle");
}

// WebAuthn + parallel workers + shared local Postgres race; serialize.
test.describe.configure({ mode: "serial" });

test.describe("Social follows + /feed", () => {
  test("/feed redirects anonymous visitors to login", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
  });

  test("/follows/requests redirects anonymous visitors to login", async ({ page }) => {
    await page.goto("/follows/requests");
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
  });

  test("Follow button toggles state on a public profile", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    const aEmail = `social-a-${stamp}@example.com`;
    const aUsername = `sa${stamp}`;
    const bEmail = `social-b-${stamp}@example.com`;
    const bUsername = `sb${stamp}`;

    await registerUser(page, aEmail, aUsername);

    // Register B in a separate browser context so we have two independent
    // sessions. New users default to `private` — B flips to public so this
    // test exercises the auto-accept path.
    const bCtx = await browser.newContext();
    const bPage = await bCtx.newPage();
    const bCdp = await bPage.context().newCDPSession(bPage);
    await setupVirtualAuthenticator(bCdp);
    await registerUser(bPage, bEmail, bUsername);
    await setProfileVisibility(bPage, "public");

    // A visits B's profile and follows.
    await page.goto(`/users/${bUsername}`);
    await expect(page.getByRole("button", { name: "Follow" })).toBeVisible();
    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible({ timeout: 5000 });

    // Follower count on B's profile should now read 1.
    await page.reload();
    await expect(page.getByRole("link", { name: /1\s+Followers/i })).toBeVisible();

    // Unfollow.
    await page.getByRole("button", { name: "Unfollow" }).click();
    await expect(page.getByRole("button", { name: "Follow" })).toBeVisible({ timeout: 5000 });

    await bCtx.close();
  });

  test("Private profile: stub for visitors, Request → Pending → Approve → full view", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    const aEmail = `req-a-${stamp}@example.com`;
    const aUsername = `ra${stamp}`;
    const bEmail = `req-b-${stamp}@example.com`;
    const bUsername = `rb${stamp}`;

    await registerUser(page, aEmail, aUsername);

    const bCtx = await browser.newContext();
    const bPage = await bCtx.newPage();
    const bCdp = await bPage.context().newCDPSession(bPage);
    await setupVirtualAuthenticator(bCdp);
    await registerUser(bPage, bEmail, bUsername);
    // B stays at the default `private`. Verify by loading the profile
    // anonymously and seeing the stub.

    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const anonResp = await anon.goto(`/users/${bUsername}`);
    expect(anonResp?.status()).toBe(200);
    await expect(anon.getByText(/This profile is private/i)).toBeVisible();

    // A (signed in) visits B's private profile — sees stub + Request button.
    await page.goto(`/users/${bUsername}`);
    await expect(page.getByText(/This profile is private/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Request to follow/i })).toBeVisible();
    await page.getByRole("button", { name: /Request to follow/i }).click();
    await expect(page.getByRole("button", { name: /Requested/i })).toBeVisible({ timeout: 5000 });

    // B sees the request in /follows/requests with badge in nav.
    await bPage.goto("/follows/requests");
    await expect(bPage.getByText(`@${aUsername}`)).toBeVisible();
    await bPage.getByRole("button", { name: "Approve" }).click();
    await bPage.waitForLoadState("networkidle");
    // Empty state after approval.
    await expect(bPage.getByText(/No pending follow requests/i)).toBeVisible();

    // A reloads B's profile — now sees full content (no stub) + Unfollow.
    await page.goto(`/users/${bUsername}`);
    await expect(page.getByText(/This profile is private/i)).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible();

    await bCtx.close();
    await anonCtx.close();
  });

  test("Private profile: visitor sees stub layout (200, not 404)", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);
    const stamp = Date.now();
    const username = `priv${stamp}`;
    await registerUser(page, `priv-${stamp}@example.com`, username);
    // User stays at default `private`.

    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const resp = await anon.goto(`/users/${username}`);
    expect(resp?.status()).toBe(200);
    await expect(anon.getByText(/This profile is private/i)).toBeVisible();

    await anonCtx.close();
  });
});
