import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/*/app/**/*.test.{ts,tsx}"],
    exclude: ["**/e2e/**", "apps/mobile/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
