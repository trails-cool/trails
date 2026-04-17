import { test, expect, type CDPSession, type Page } from "@playwright/test";

// Virtual authenticator helpers
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

async function registerUser(page: Page, email: string, username: string) {
  await page.goto("/auth/register");
  await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
  await page.getByLabel("Email").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").click();
  await page.getByLabel("Username").fill(username);
  // Verify both fields retained values before submitting
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Username")).toHaveValue(username);
  // Accept the Terms of Service (required)
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Register with Passkey/ }).click();
}

async function logout(page: Page) {
  await page.getByRole("navigation").getByRole("button", { name: "Log Out" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Sign In" })).toBeVisible({ timeout: 5000 });
}

test.describe("Passkey Authentication", () => {
  test("register with passkey and sign in", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    const email = `test-${Date.now()}@example.com`;
    const username = `testuser${Date.now()}`;

    // Register
    await registerUser(page, email, username);
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByRole("navigation").getByText(username)).toBeVisible({ timeout: 5000 });

    // Log out
    await logout(page);

    // Sign in with passkey
    await page.goto("/auth/login");
    await page.getByRole("button", { name: /Sign in with Passkey/ }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByRole("navigation").getByText(username)).toBeVisible({ timeout: 5000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("passkey login fails with no registered credential", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    await page.goto("/auth/login");
    await page.getByRole("button", { name: /Sign in with Passkey/ }).click();
    await expect(page.getByText(/No passkey found/i)).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("register rejects duplicate email", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    const email = `dup-${Date.now()}@example.com`;

    // Register first user
    await registerUser(page, email, `first${Date.now()}`);
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await logout(page);

    // Try to register with same email
    await registerUser(page, email, `second${Date.now()}`);
    await expect(page.getByText(/already in use/i)).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("register rejects duplicate username", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    const username = `uniq${Date.now()}`;

    // Register first user
    await registerUser(page, `first-${Date.now()}@example.com`, username);
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await logout(page);

    // Try to register with same username
    await registerUser(page, `second-${Date.now()}@example.com`, username);
    await expect(page.getByText(/already taken/i)).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });
});
