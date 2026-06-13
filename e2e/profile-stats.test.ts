import { test, expect, gotoHydrated } from "./fixtures/test";
import { setupVirtualAuthenticator, registerUser } from "./helpers/auth";

test.describe("Profile stats", () => {
  test("owner profile shows a roll-up header counting their activities", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    const username = `ps${stamp}`;
    await registerUser(page, `ps-${stamp}@example.com`, username);

    // Two activities → the owner's roll-up should count both.
    for (const name of ["First outing", "Second outing"]) {
      await gotoHydrated(page, "/activities/new");
      await page.getByLabel("Name").fill(name);
      await page.getByRole("button", { name: "Create Activity" }).click();
      await expect(page).toHaveURL(/\/activities\/[0-9a-f-]+$/, { timeout: 10000 });
    }

    await gotoHydrated(page, `/users/${username}`);
    // The roll-up header — the "N in the last 4 weeks" line is unique to it
    // (the section headings below read "Activities (N)").
    await expect(page.getByText("2 in the last 4 weeks")).toBeVisible();
  });
});
