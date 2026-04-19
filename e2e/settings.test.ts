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

async function removeVirtualAuthenticator(cdp: CDPSession, authenticatorId: string) {
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  await cdp.send("WebAuthn.disable");
}

async function registerAndLogin(page: Page, cdp: CDPSession) {
  const email = `settings-${Date.now()}@example.com`;
  const username = `settingsuser${Date.now()}`;

  await page.goto("/auth/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: /Register with Passkey/ }).click();
  await expect(page).toHaveURL("/", { timeout: 10000 });

  return { email, username };
}

test.describe("Account Settings", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });

  test("settings page loads for authenticated user", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Profile")).toBeVisible();
    await expect(page.getByText("Security")).toBeVisible();
    await expect(page.getByText("Account")).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("update display name and bio", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerAndLogin(page, cdp);

    await page.goto("/settings");

    await page.getByLabel("Display Name").fill("Test Display Name");
    await page.getByLabel("Bio").fill("I love hiking!");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible({ timeout: 5000 });

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByLabel("Display Name")).toHaveValue("Test Display Name");
    await expect(page.getByLabel("Bio")).toHaveValue("I love hiking!");

    // Verify public profile reflects changes
    await page.goto(`/users/${username}`);
    await expect(page.getByText("Test Display Name")).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("passkey list shows registered passkey", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    await page.goto("/settings");
    // Should show the passkey registered during registration
    await expect(page.getByText("This device")).toBeVisible();
    await expect(page.getByText(/Added/)).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("add and delete passkey from settings", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    await page.goto("/settings");

    // Should have 1 passkey from registration
    const deleteButtons = page.getByRole("button", { name: "Delete" });
    await expect(deleteButtons).toHaveCount(1);

    // Add another passkey
    await page.getByRole("button", { name: "Add Passkey" }).click();
    await page.waitForTimeout(1000);

    // After reload, should have 2 passkeys
    await expect(deleteButtons).toHaveCount(2, { timeout: 5000 });

    // Delete one
    page.on("dialog", (dialog) => dialog.accept());
    await deleteButtons.first().click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 5000 });
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(1);

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("delete last passkey shows warning", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    await page.goto("/settings");

    // Intercept the confirm dialog to check it contains the warning
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.getByRole("button", { name: "Delete" }).click();
    expect(dialogMessage).toContain("only passkey");

    // After deleting, should show "No passkeys registered"
    await expect(page.getByText(/No passkeys registered/)).toBeVisible({ timeout: 5000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("settings link visible in nav when logged in", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerAndLogin(page, cdp);

    await expect(page.getByRole("navigation").getByRole("link", { name: "Settings" })).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("settings link not visible when logged out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Settings" })).not.toBeVisible();
  });

  test("account deletion requires correct username", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerAndLogin(page, cdp);

    await page.goto("/settings");

    // Click delete account
    await page.getByRole("button", { name: "Delete Account" }).click();

    // Type wrong username — button should be disabled
    await page.getByPlaceholder(username).fill("wrongname");
    await expect(page.getByRole("button", { name: "Permanently Delete" })).toBeDisabled();

    // Type correct username — button should be enabled
    await page.getByPlaceholder(username).fill(username);
    await expect(page.getByRole("button", { name: "Permanently Delete" })).toBeEnabled();

    // Submit deletion
    await page.getByRole("button", { name: "Permanently Delete" }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Session should be destroyed — nav should show login
    await expect(page.getByRole("navigation").getByRole("link", { name: "Sign In" })).toBeVisible({ timeout: 5000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });
});
