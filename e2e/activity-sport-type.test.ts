import { test, expect, gotoHydrated } from "./fixtures/test";
import { setupVirtualAuthenticator, registerUser } from "./helpers/auth";

test.describe("Activity sport type", () => {
  test("create an activity with a sport renders the sport badge", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await setupVirtualAuthenticator(cdp);

    const stamp = Date.now();
    await registerUser(page, `sport-${stamp}@example.com`, `sport${stamp}`);

    await gotoHydrated(page, "/activities/new");

    // Name deliberately avoids the sport word so the badge assertion can't
    // accidentally match the title.
    await page.getByLabel("Name").fill("Saturday loop");
    // exact: the nav avatar button's aria-label is the username ("sport…"),
    // which a loose "Sport" match would also catch.
    await page.getByLabel("Sport", { exact: true }).selectOption("gravel");
    await page.getByRole("button", { name: "Create Activity" }).click();

    // Redirects to the new activity's detail page.
    await expect(page).toHaveURL(/\/activities\/[0-9a-f-]+$/, { timeout: 10000 });

    // Title plus the localized sport badge ("Gravel").
    await expect(page.getByRole("heading", { name: "Saturday loop" })).toBeVisible();
    await expect(page.getByText("Gravel")).toBeVisible();
  });
});
