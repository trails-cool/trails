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

// WebAuthn + parallel workers + shared local Postgres race; serialize.
test.describe.configure({ mode: "serial" });

test.describe("Social follows + /feed", () => {
  test("/feed redirects anonymous visitors to login", async ({ page }) => {
    await page.goto("/feed");
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

    // Register A in the main page.
    await registerUser(page, aEmail, aUsername);

    // Register B in a separate browser context (independent session).
    const bCtx = await browser.newContext();
    const bPage = await bCtx.newPage();
    const bCdp = await bPage.context().newCDPSession(bPage);
    await setupVirtualAuthenticator(bCdp);
    await registerUser(bPage, bEmail, bUsername);

    // B's profile alone won't render publicly without any public content;
    // that's tested elsewhere. For follow-button transitions, we use the
    // user-list page directly (which gates only on profile_visibility).
    // Instead, seed a public route from B via the existing routes.new
    // flow so B's profile renders.
    await bPage.goto("/routes/new");
    await bPage.getByLabel("Name").fill("Public ride");
    await bPage.getByRole("button", { name: "Create Route" }).click();
    await bPage.waitForURL(/\/routes\/[0-9a-f-]+$/, { timeout: 10000 });
    const url = bPage.url();
    const id = url.split("/").pop()!;
    await bPage.goto(`/routes/${id}/edit`);
    await bPage.getByLabel("Visibility").selectOption("public");
    await bPage.getByRole("button", { name: "Save Changes" }).click();
    await bPage.waitForURL(new RegExp(`/routes/${id}$`), { timeout: 10000 });

    // A visits B's profile and follows.
    await page.goto(`/users/${bUsername}`);
    await expect(page.getByRole("button", { name: "Follow" })).toBeVisible();
    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible({ timeout: 5000 });

    // Follower count on B's profile should now read 1.
    await page.reload();
    await expect(page.getByRole("link", { name: /1\s+Followers/i })).toBeVisible();

    // Unfollow goes back to Follow.
    await page.getByRole("button", { name: "Unfollow" }).click();
    await expect(page.getByRole("button", { name: "Follow" })).toBeVisible({ timeout: 5000 });

    await bCtx.close();
  });

  test("Profile visibility toggle: private 404s, public restores", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    const ownerEmail = `vis-${stamp}@example.com`;
    const ownerUsername = `vu${stamp}`;
    await registerUser(page, ownerEmail, ownerUsername);

    // Create a public route so the owner's profile would otherwise render.
    await page.goto("/routes/new");
    await page.getByLabel("Name").fill("Trail run");
    await page.getByRole("button", { name: "Create Route" }).click();
    await page.waitForURL(/\/routes\/[0-9a-f-]+$/, { timeout: 10000 });
    const url = page.url();
    const id = url.split("/").pop()!;
    await page.goto(`/routes/${id}/edit`);
    await page.getByLabel("Visibility").selectOption("public");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForURL(new RegExp(`/routes/${id}$`), { timeout: 10000 });

    // Visitor: profile reachable.
    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const before = await anon.goto(`/users/${ownerUsername}`);
    expect(before?.status()).toBe(200);

    // Owner flips to private.
    await page.goto("/settings");
    await page.getByLabel("Private").check();
    await page.getByRole("button", { name: /^Save$/ }).first().click();
    await page.waitForLoadState("networkidle");

    const after = await anon.goto(`/users/${ownerUsername}`);
    expect(after?.status()).toBe(404);

    // Flip back to public.
    await page.goto("/settings");
    await page.getByLabel("Public").check();
    await page.getByRole("button", { name: /^Save$/ }).first().click();
    await page.waitForLoadState("networkidle");

    const restored = await anon.goto(`/users/${ownerUsername}`);
    expect(restored?.status()).toBe(200);

    await anonCtx.close();
  });
});
