import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Separate config for Vitest browser visual regression tests.
// Run with: pnpm --filter @trails-cool/planner test:visual
// Update snapshots: pnpm --filter @trails-cool/planner test:visual:update
//
// Snapshots live next to each test file in a __screenshots__/ directory.
// On CI, snapshots are updated via the "Update visual snapshots" workflow
// (.github/workflows/update-visual-snapshots.yml), triggered manually or
// by adding the `update-snapshots` label to a PR.
export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "app"),
    },
  },
  test: {
    name: "browser",
    include: ["app/**/*.browser.test.{ts,tsx}"],
    browser: {
      enabled: true,
      // Provider is resolved from whichever @vitest/browser peer is installed.
      // playwright is the default when @playwright/test is available.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provider: "playwright" as any,
      instances: [{ browser: "chromium" }],
    },
  },
});
