import { test as base, expect } from "@playwright/test";

/**
 * Hosts the E2E environment is allowed to contact for real. Anything
 * else that reaches our catch-all route (i.e. not intercepted by a
 * test-specific `page.route(...)`) is aborted, and the test fails
 * at teardown with the list of blocked URLs.
 *
 * The trigger for this safety net was #282 — a POI test that silently
 * relied on live Overpass data for months because its `page.route`
 * was pointing at a URL the browser no longer hit after the POI proxy
 * was introduced. With this fixture in place, a request to any unlisted
 * host would abort and the test would surface the missing mock
 * immediately. (POIs are now served from the same-origin `/api/pois`
 * index endpoint, so the map makes no third-party POI requests at all.)
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

/**
 * External requests we silently drop (no allowlist, no failure). The
 * Sentry browser SDK emits an envelope on first navigation even when
 * `enabled: false` (the BrowserTracing integration captures the page
 * load transaction before `init`'s enabled flag fully propagates). We
 * don't want to allow it through to the real ingest endpoint, but we
 * also don't want every test to fail with "blocked unmocked request".
 */
const SILENT_DROP: RegExp[] = [
  /ingest\.[a-z]+\.sentry\.io/,
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
      if (SILENT_DROP.some((re) => re.test(url))) {
        await route.abort("failed");
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

/**
 * Wait until React has hydrated the current page. Vite dev injects scripts
 * asynchronously, so a button/form is visible (and clickable per Playwright's
 * actionability check) before its React `onClick`/`onSubmit` is wired up.
 * Without this, the first click after navigation is a coin flip on a cold
 * dev server — controlled inputs ignore the keystrokes and submit handlers
 * never run, so the form posts empty fields or natively GETs to itself.
 *
 * Detects hydration by checking for React's `__reactProps$<id>` property
 * which is attached during commit. CI uses production builds where this
 * isn't a problem, but the check is cheap and harmless there.
 */
export async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const el = document.body.querySelector("button, input, form, a");
      if (!el) return false;
      return Object.keys(el).some((k) => k.startsWith("__reactProps$"));
    },
    null,
    { timeout: 10000 },
  );
}

/**
 * Navigate and wait for the page to be hydrated before returning.
 *
 * Use this (instead of bare `page.goto`) whenever the very next step
 * interacts with a control whose behaviour lives in a React handler —
 * notably the onClick-driven FollowButton and the profile-settings
 * fetcher form. A button is "visible and enabled" per Playwright's
 * actionability check before React has attached its onClick, so a click
 * in that window is silently dropped (or triggers a native form submit),
 * which is the dominant source of the cold-server e2e flake. Waiting for
 * hydration at the navigation closes that race so individual tests can't
 * forget it per interaction.
 */
export async function gotoHydrated(page: import("@playwright/test").Page, url: string) {
  await page.goto(url);
  await waitForHydration(page);
}

export { expect };
export type { CDPSession, Page } from "@playwright/test";
