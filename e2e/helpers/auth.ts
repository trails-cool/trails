// Shared auth helpers for journal specs. These were previously
// copy-pasted per spec file and had already drifted (the auth spec's
// registerUser lost the final URL assertion the other copies had, and
// the settings spec's variant skipped hydration and the Terms
// checkbox). One canonical copy lives here.

import { expect, waitForHydration, type CDPSession, type Page } from "../fixtures/test";

export async function setupVirtualAuthenticator(cdp: CDPSession): Promise<string> {
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

export async function removeVirtualAuthenticator(
  cdp: CDPSession,
  authenticatorId: string,
): Promise<void> {
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  await cdp.send("WebAuthn.disable");
}

/**
 * Fill and submit the registration form (passkey + Terms acceptance).
 * Makes no assertion about the outcome — use this directly for
 * expected-failure attempts (duplicate email/username), and
 * registerUser for the success path.
 */
export async function submitRegistration(
  page: Page,
  email: string,
  username: string,
): Promise<void> {
  await page.goto("/auth/register");
  await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
  await waitForHydration(page);
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

/** Register a user with a passkey and wait for the signed-in redirect. */
export async function registerUser(page: Page, email: string, username: string): Promise<void> {
  await submitRegistration(page, email, username);
  await expect(page).toHaveURL("/", { timeout: 10000 });
}

/** Register a throwaway user with unique credentials derived from `prefix`. */
export async function registerFreshUser(
  page: Page,
  prefix: string,
): Promise<{ email: string; username: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const username = `${prefix}${Date.now()}`;
  await registerUser(page, email, username);
  return { email, username };
}

export async function logout(page: Page, accountLabel: string): Promise<void> {
  // The account cluster lives inside an avatar dropdown. Click the
  // avatar (its aria-label is displayName || username), then click the
  // Log Out menuitem inside the popup.
  await waitForHydration(page);
  await page.getByRole("navigation").getByRole("button", { name: accountLabel }).click();
  await page.getByRole("menuitem", { name: "Log Out" }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Sign In" }),
  ).toBeVisible({ timeout: 5000 });
}
