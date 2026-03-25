import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";
import { yjsDevPlugin } from "./app/lib/vite-yjs-plugin.ts";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), yjsDevPlugin()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  server: {
    port: 3001,
  },
});
