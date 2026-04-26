import { test, expect, type CDPSession, type Page } from "./fixtures/test";

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
  await page.locator(`input[type=radio][name=profileVisibility][value=${value}]`).check();
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await expect(page.getByText("Profile saved.")).toBeVisible({ timeout: 10000 });
}

test.describe.configure({ mode: "serial" });

test.describe("/explore", () => {
  test("anonymous visitor can load /explore", async ({ page }) => {
    const resp = await page.goto("/explore");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  });

  test("private profile is excluded from the directory", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    // A: signed-in viewer (public, default in test below)
    const aEmail = `ex-a-${stamp}@example.com`;
    const aUsername = `exa${stamp}`;
    await registerUser(page, aEmail, aUsername);
    await setProfileVisibility(page, "public");

    // B: a separate user who stays at the default `private`
    const bCtx = await browser.newContext();
    const bPage = await bCtx.newPage();
    const bCdp = await bPage.context().newCDPSession(bPage);
    await setupVirtualAuthenticator(bCdp);
    const bEmail = `ex-b-${stamp}@example.com`;
    const bUsername = `exb${stamp}`;
    await registerUser(bPage, bEmail, bUsername);
    // B stays private — should NOT appear on /explore.

    // A loads /explore — the directory should include A but not B.
    await page.goto("/explore");
    await expect(page.getByText(`@${aUsername}`)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(`@${bUsername}`)).toHaveCount(0);

    await bCtx.close();
  });
});
