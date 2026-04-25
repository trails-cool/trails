import { reactRouter } from "@react-router/dev/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    sourcemap: "hidden",
  },
  plugins: [
    tailwindcss(),
    reactRouter(),
    ...(process.env.HTTPS === "1" ? [import("@vitejs/plugin-basic-ssl").then((m) => m.default())] : []),
    sentryVitePlugin({
      org: "trails-qq",
      project: "journal",
      release: { name: process.env.SENTRY_RELEASE },
      sourcemaps: { filesToDeleteAfterUpload: ["./build/**/*.map"] },
      disable: !process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Force HTTP/1.1 over TLS in HTTPS dev. Vite v8 starts an
    // `http2.createSecureServer({ allowHTTP1: true })` for any HTTPS
    // config, so ALPN negotiates h2 by default. That breaks
    // `useFetcher().Form` POSTs because React Router's CSRF check in
    // `singleFetchAction` compares `Origin` against the `Host` header,
    // which HTTP/2 replaces with `:authority` and Node doesn't
    // synthesize back. Restricting ALPN to `http/1.1` keeps the Host
    // header intact and lets fetcher form submissions through.
    // Plain HTTP dev (the default) is unaffected.
    https: process.env.HTTPS === "1" ? { ALPNProtocols: ["http/1.1"] } : undefined,
  },
});
