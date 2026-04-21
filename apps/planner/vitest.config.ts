import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";
import { resolve } from "node:path";

// Mirror the `~` alias that React Router's runtime provides so test
// files can resolve `~/lib/...` the same way the route modules do.
export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "~": resolve(import.meta.dirname, "app"),
      },
    },
  }),
);
