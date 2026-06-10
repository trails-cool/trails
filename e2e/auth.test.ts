import { test, expect, waitForHydration, type CDPSession, type Page } from "./fixtures/test";
import { setupVirtualAuthenticator, removeVirtualAuthenticator, submitRegistration, logout } from "./helpers/auth";

test.describe("Passkey Authentication", () => {
  test("register with passkey and sign in", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    const email = `test-${Date.now()}@example.com`;
    const username = `testuser${Date.now()}`;

    // Register
    await submitRegistration(page, email, username);
    await expect(page).toHaveURL("/", { timeout: 10000 });
    // The avatar button's aria-label is the displayName or username;
    // for a freshly-registered user with no displayName set, that's
    // the username.
    await expect(page.getByRole("navigation").getByRole("button", { name: username })).toBeVisible({ timeout: 5000 });

    // Log out
    await logout(page, username);

    // Sign in with passkey
    await page.goto("/auth/login");
    await waitForHydration(page);
    await page.getByRole("button", { name: /Sign in with Passkey/ }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByRole("navigation").getByRole("button", { name: username })).toBeVisible({ timeout: 5000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("passkey login fails with no registered credential", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    await page.goto("/auth/login");
    await waitForHydration(page);
    await page.getByRole("button", { name: /Sign in with Passkey/ }).click();
    await expect(page.getByText(/No passkey found/i)).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("register rejects duplicate email", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    const email = `dup-${Date.now()}@example.com`;
    const firstUsername = `first${Date.now()}`;

    // Register first user
    await submitRegistration(page, email, firstUsername);
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await logout(page, firstUsername);

    // Try to register with same email
    await submitRegistration(page, email, `second${Date.now()}`);
    await expect(page.getByText(/already in use/i)).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("register rejects duplicate username", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);

    const username = `uniq${Date.now()}`;

    // Register first user
    await submitRegistration(page, `first-${Date.now()}@example.com`, username);
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await logout(page, username);

    // Try to register with same username
    await submitRegistration(page, `second-${Date.now()}@example.com`, username);
    await expect(page.getByText(/already taken/i)).toBeVisible({ timeout: 10000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });
});
