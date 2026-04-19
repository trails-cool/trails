import { test as base, expect } from "@playwright/test";

/**
 * Hosts the E2E environment is allowed to contact for real. Anything
 * else that reaches our catch-all route (i.e. not intercepted by a
 * test-specific `page.route(...)`) is aborted, and the test fails
 * at teardown with the list of blocked URLs.
 *
 * The trigger for this safety net was #282 — a POI test that silently
 * relied on live Overpass data for months because its `page.route`
 * was pointing at a URL the browser no longer hit after `/api/overpass`
 * was introduced. With this fixture in place, a request to
 * `overpass.private.coffee` (or any other unlisted host) would abort
 * and the test would surface the missing mock immediately.
 */
const EXTERNAL_ALLOWLIST: RegExp[] = [
  // App origins served by Playwright's webServer
  /^https?:\/\/localhost(:\d+)?\//,
  /^https?:\/\/127\.0\.0\.1(:\d+)?\//,
  // Tile CDNs used by the map layers in packages/map-core/src/tiles.ts
  /tile\.openstreetmap\.org/,
  /tile\.opentopomap\.org/,
  /tile-cyclosm\.openstreetmap\.fr/,
  /tile\.waymarkedtrails\.org/,
  /tiles\.wmflabs\.org/,
];

export const test = base.extend({
  page: async ({ page }, use) => {
    const blocked: string[] = [];

    // Registered first, so a test's later `page.route(pattern, ...)`
    // calls take precedence (Playwright runs handlers in reverse
    // registration order). When no specific mock matches, this
    // catch-all decides between continue (allowlist) and abort.
    await page.route("**", async (route) => {
      const url = route.request().url();
      if (EXTERNAL_ALLOWLIST.some((re) => re.test(url))) {
        await route.continue();
        return;
      }
      blocked.push(url);
      await route.abort("failed");
    });

    await use(page);

    if (blocked.length > 0) {
      const unique = [...new Set(blocked)];
      const preview = unique.slice(0, 10).join("\n  ");
      const more = unique.length > 10 ? `\n  …and ${unique.length - 10} more` : "";
      throw new Error(
        `${blocked.length} unmocked external request(s) blocked:\n  ${preview}${more}\n\n` +
          `Either mock them with page.route(...) in the test, or add a\n` +
          `pattern to EXTERNAL_ALLOWLIST in e2e/fixtures/test.ts.`,
      );
    }
  },
});

export { expect };
export type { CDPSession, Page } from "@playwright/test";
