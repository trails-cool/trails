import { test, expect, waitForHydration, type CDPSession, type Page } from "./fixtures/test";
import { setupVirtualAuthenticator, registerUser } from "./helpers/auth";

async function setProfileVisibility(page: Page, value: "public" | "private") {
  await page.goto("/settings/profile");
  // Wait for hydration so the visibility form submits via the fetcher
  // (and shows the "Profile saved." toast) instead of native-navigating.
  await waitForHydration(page);
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
