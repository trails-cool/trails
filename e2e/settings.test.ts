import { test, expect, waitForHydration, type Page } from "./fixtures/test";
import { setupVirtualAuthenticator, removeVirtualAuthenticator, registerFreshUser } from "./helpers/auth";

// Settings is split into sibling sections, each with a stable URL:
//   /settings          → redirects to /settings/profile
//   /settings/profile  → display name, bio, visibility
//   /settings/security → passkeys
//   /settings/account  → email change, account deletion
// The left-hand section nav lists Profile / Account / Security /
// Connected services as links.

test.describe("Account Settings", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });

  test("settings page loads for authenticated user", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerFreshUser(page, "settings");

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    // Section nav links (the avatar dropdown is closed, so these names
    // are unique to the settings section nav).
    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Security" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account" })).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("update display name and bio", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerFreshUser(page, "settings");

    await page.goto("/settings/profile");
    await waitForHydration(page);

    // Target the inputs by id — robust against the Vite dev server
    // transiently double-rendering the form during hydration.
    await page.locator("#displayName").fill("Test Display Name");
    await page.locator("#bio").fill("I love hiking!");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible({ timeout: 5000 });

    // Reload and verify persistence
    await page.reload();
    await expect(page.locator("#displayName")).toHaveValue("Test Display Name");
    await expect(page.locator("#bio")).toHaveValue("I love hiking!");

    // Verify public profile reflects changes
    await page.goto(`/users/${username}`);
    await expect(page.getByText("Test Display Name")).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("passkey list shows registered passkey", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerFreshUser(page, "settings");

    await page.goto("/settings/security");
    // The passkey registered during sign-up shows as "This device".
    await expect(page.getByText("This device")).toBeVisible();
    await expect(page.getByText(/Added/)).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("add and delete passkey from settings", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerFreshUser(page, "settings");

    await page.goto("/settings/security");
    await waitForHydration(page);

    // Should have 1 passkey from registration
    const deleteButtons = page.getByRole("button", { name: "Delete" });
    await expect(deleteButtons).toHaveCount(1);

    // Add another passkey
    await page.getByRole("button", { name: "Add Passkey" }).click();

    // After the ceremony + reload, should have 2 passkeys
    await expect(deleteButtons).toHaveCount(2, { timeout: 5000 });

    // Delete one
    page.on("dialog", (dialog) => dialog.accept());
    await deleteButtons.first().click();
    await expect(page).toHaveURL(/\/settings\/security/, { timeout: 5000 });
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(1);

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("delete last passkey shows warning", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    await registerFreshUser(page, "settings");

    await page.goto("/settings/security");
    await waitForHydration(page);

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

  test("settings link reachable from nav when logged in", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerFreshUser(page, "settings");

    // Settings lives inside the avatar dropdown; wait for hydration so
    // the dropdown's open handler is wired before clicking it.
    await waitForHydration(page);
    await page.getByRole("navigation").getByRole("button", { name: username }).click();
    await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });

  test("settings link not visible when logged out", async ({ page }) => {
    await page.goto("/");
    // Anonymous navbar has neither the avatar nor a Settings link.
    await expect(page.getByRole("navigation").getByRole("link", { name: "Settings" })).not.toBeVisible();
  });

  test("account deletion requires correct username", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await setupVirtualAuthenticator(cdp);
    const { username } = await registerFreshUser(page, "settings");

    await page.goto("/settings/account");
    await waitForHydration(page);

    // Open the delete-account confirmation.
    await page.getByRole("button", { name: "Delete Account" }).click();

    // Wrong username — confirm button disabled
    await page.getByPlaceholder(username).fill("wrongname");
    await expect(page.getByRole("button", { name: "Permanently Delete" })).toBeDisabled();

    // Correct username — confirm button enabled
    await page.getByPlaceholder(username).fill(username);
    await expect(page.getByRole("button", { name: "Permanently Delete" })).toBeEnabled();

    // Submit deletion
    await page.getByRole("button", { name: "Permanently Delete" }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Session destroyed — nav shows Sign In again
    await expect(page.getByRole("navigation").getByRole("link", { name: "Sign In" })).toBeVisible({ timeout: 5000 });

    await removeVirtualAuthenticator(cdp, authenticatorId);
  });
});
