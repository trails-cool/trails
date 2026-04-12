import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";
import { resolve } from "node:path";

export default mergeConfig(shared, defineConfig({
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "app"),
    },
  },
}));
