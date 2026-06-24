import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";
import { resolve } from "node:path";

export default mergeConfig(shared, defineConfig({
  test: {
    // mergeConfig concatenates arrays, so this adds to the shared
    // include globs rather than replacing them. Picks up co-located
    // tests for root-level server infra (server.ts, serve-static.ts)
    // that live outside app/ and src/.
    include: ["*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "app"),
    },
  },
}));
