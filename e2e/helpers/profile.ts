import { expect, gotoHydrated, type Page } from "../fixtures/test";

/**
 * Set the logged-in user's profile visibility via /settings/profile.
 * Single source of truth — this was copy-pasted across the explore,
 * social, and notifications specs, two of which omitted the hydration
 * wait and so raced the fetcher-backed Save on a cold server.
 */
export async function setProfileVisibility(page: Page, value: "public" | "private") {
  // gotoHydrated so the visibility form submits via the fetcher (and
  // shows the "Profile saved." toast) instead of native-navigating.
  await gotoHydrated(page, "/settings/profile");
  // Target the radio by name+value; getByLabel collides because one
  // radio's help text mentions the other's word ("public" appears in
  // the Private radio's helper sentence).
  await page.locator(`input[type=radio][name=profileVisibility][value=${value}]`).check();
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  // SSE keeps the network busy, so don't wait on networkidle — wait for
  // the explicit save confirmation instead.
  await expect(page.getByText("Profile saved.")).toBeVisible({ timeout: 10000 });
}
