import { reactRouter } from "@react-router/dev/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";
import { yjsDevPlugin } from "./app/lib/vite-yjs-plugin.ts";

export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    tailwindcss(),
    reactRouter(),
    yjsDevPlugin(),
    sentryVitePlugin({
      org: "trails-qq",
      project: "planner",
      release: { name: process.env.SENTRY_RELEASE },
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  server: {
    port: 3001,
  },
});
