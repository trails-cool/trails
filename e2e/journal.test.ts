import { test, expect } from "./fixtures/test";

test.describe("Journal", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("trails.cool");
    await expect(page.getByText("Your outdoor activity journal")).toBeVisible();
  });

  test("shows register and sign in when logged out", async ({ page }) => {
    await page.goto("/");
    // Nav bar has Register and Sign In links
    await expect(page.getByRole("navigation").getByRole("link", { name: "Register" })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Sign In" })).toBeVisible();
  });

  test("registration page renders correctly", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByRole("button", { name: /Register with Passkey/ })).toBeVisible();
    // No password field
    await expect(page.locator('input[type="password"]')).not.toBeVisible();
  });

  test("login page has passkey and magic link options", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: /Sign in with Passkey/ })).toBeVisible();
    await expect(page.getByText(/magic link/i)).toBeVisible();
  });

  test("nav bar shows on all pages", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
    // Logo/title links home
    await expect(nav.getByRole("link", { name: "trails.cool" })).toBeVisible();
    // Logged-out nav does not show Routes or Activities
    await expect(nav.getByRole("link", { name: "Routes" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Activities" })).not.toBeVisible();
  });

  test("routes page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/routes");
    await expect(page).toHaveURL(/auth\/login/);
  });

  test("activities page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/activities");
    await expect(page).toHaveURL(/auth\/login/);
  });
});
