import { test, expect } from "@playwright/test";

test.describe("Journal", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("trails.cool");
    await expect(page.getByText("Your outdoor activity journal")).toBeVisible();
  });

  test("shows register and sign in when logged out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("registration page renders correctly", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.getByText("Register")).toBeVisible();
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

  test("routes page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/routes");
    await expect(page).toHaveURL(/auth\/login/);
  });

  test("activities page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/activities");
    await expect(page).toHaveURL(/auth\/login/);
  });
});
