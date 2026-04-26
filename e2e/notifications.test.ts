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
  // Don't use waitForLoadState("networkidle") — the SSE connection to
  // /api/events keeps the network busy indefinitely. Wait for the
  // explicit save confirmation instead.
  await expect(page.getByText("Profile saved.")).toBeVisible({ timeout: 10000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Notifications", () => {
  test("anonymous /notifications redirects to login", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
  });

  test("public auto-accept follow → recipient sees follow_received notification", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    const aEmail = `nf-a-${stamp}@example.com`;
    const aUsername = `nfa${stamp}`;
    const bEmail = `nf-b-${stamp}@example.com`;
    const bUsername = `nfb${stamp}`;

    await registerUser(page, aEmail, aUsername);

    const bCtx = await browser.newContext();
    const bPage = await bCtx.newPage();
    const bCdp = await bPage.context().newCDPSession(bPage);
    await setupVirtualAuthenticator(bCdp);
    await registerUser(bPage, bEmail, bUsername);
    await setProfileVisibility(bPage, "public");

    // A follows B (auto-accept).
    await page.goto(`/users/${bUsername}`);
    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible({ timeout: 5000 });

    // B opens /notifications — should see one row referencing A.
    await bPage.goto("/notifications");
    await expect(bPage.getByText(new RegExp(`${aUsername}.+started following`))).toBeVisible({ timeout: 10000 });

    // Mark all read clears the unread badge. The button disappears when
    // hasUnread flips to false; the toBeHidden assertion polls.
    await bPage.getByRole("button", { name: /Mark all read/i }).click();
    await expect(bPage.getByRole("button", { name: /Mark all read/i })).toBeHidden({ timeout: 10000 });

    await bCtx.close();
  });

  test("private profile: request → approve → follower sees follow_request_approved notification", async ({ page, browser }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    const aEmail = `nfap-a-${stamp}@example.com`;
    const aUsername = `nfapa${stamp}`;
    const bEmail = `nfap-b-${stamp}@example.com`;
    const bUsername = `nfapb${stamp}`;

    await registerUser(page, aEmail, aUsername);

    const bCtx = await browser.newContext();
    const bPage = await bCtx.newPage();
    const bCdp = await bPage.context().newCDPSession(bPage);
    await setupVirtualAuthenticator(bCdp);
    await registerUser(bPage, bEmail, bUsername);
    // B stays private (default).

    // A requests to follow B.
    await page.goto(`/users/${bUsername}`);
    await page.getByRole("button", { name: /Request to follow/i }).click();
    await expect(page.getByRole("button", { name: /Requested/i })).toBeVisible({ timeout: 5000 });

    // B approves the request from the Requests tab on /notifications.
    // After the fetcher.Form revalidates, the empty-state copy
    // replaces the request row.
    await bPage.goto("/notifications?tab=requests");
    await bPage.getByRole("button", { name: "Approve" }).click();
    await expect(bPage.getByText(/No pending follow requests/i)).toBeVisible({ timeout: 10000 });

    // A reloads /notifications — should see follow_request_approved
    // referencing B (the target's username).
    await page.goto("/notifications");
    await expect(page.getByText(new RegExp(`${bUsername}.+accepted your follow request`))).toBeVisible({ timeout: 10000 });

    await bCtx.close();
  });
});
