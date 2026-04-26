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
    // Local HTTPS dev is OPT-IN via `HTTPS=1`. Plain HTTP is the default
    // and the right choice for ~everything: WebAuthn (passkeys) treats
    // `localhost` as a secure context regardless of scheme, magic links
    // work over HTTP, sessions / Terms gate / SSE all work over HTTP.
    // CI doesn't set HTTPS=1 either — the e2e suite runs against the
    // production `react-router-serve` build over plain HTTP and passes
    // cleanly. So most contributors should never touch this flag.
    //
    // The one case where you DO need HTTPS=1 locally:
    //   - Wahoo OAuth callback testing — Wahoo (and most OAuth
    //     providers) reject `http://` redirect URIs, so the
    //     /api/sync/connect/wahoo flow can only complete against an
    //     HTTPS dev server. See docs/tooling.md for the full
    //     command (`HTTPS=1 ORIGIN=https://localhost:3000 pnpm
    //     --filter @trails-cool/journal dev`) and gotchas.
    //
    // If you find yourself wanting HTTPS=1 for any other reason, write
    // it down in docs/tooling.md — the assumption that "everything but
    // Wahoo works over HTTP locally" is what keeps the CI/local
    // configurations symmetric.
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
    // Pre-transform the entry + every route at server startup so Vite
    // discovers every dependency it'll ever need before the first
    // browser request lands. Two real benefits:
    //
    // 1. Eliminates the `[vite] new dependencies optimized → reloading`
    //    full page reload that otherwise fires on the *first* visit to
    //    a route Vite hasn't seen yet. For everyday dev this reload is
    //    a one-time blip; for batch operations (e.g. e2e runs hitting
    //    many routes back-to-back on a fresh server) it's a real source
    //    of flakiness.
    //
    // 2. Hydration is faster on first visit because the JS bundle is
    //    already optimized, which incidentally narrows (but does NOT
    //    fully close) a separate Playwright-vs-hydration race in the
    //    auth e2e tests. That race is hydration-timing, not Vite
    //    dep-discovery, and needs a different fix to fully resolve.
    //
    // Listing all route .tsx files via a glob keeps this future-proof
    // — any new route added under app/routes/ is included automatically.
    warmup: {
      clientFiles: [
        "./app/entry.client.tsx",
        "./app/root.tsx",
        // Page routes only (.tsx). The .ts handlers under routes/ are
        // server-only API endpoints that import `*.server.ts` modules
        // — Vite refuses to transform those for the client and prints
        // "Server-only module referenced by client" if you include them.
        // Page components alone are enough to drive dep discovery.
        "./app/routes/**/*.tsx",
      ],
    },
    // Force HTTP/1.1 over TLS in HTTPS dev. Vite v8 starts an
    // `http2.createSecureServer({ allowHTTP1: true })` for any HTTPS
    // config, so ALPN negotiates h2 by default. That breaks
    // `useFetcher().Form` POSTs because React Router's CSRF check in
    // `singleFetchAction` compares `Origin` against the `Host` header,
    // which HTTP/2 replaces with `:authority` and Node doesn't
    // synthesize back. Restricting ALPN to `http/1.1` keeps the Host
    // header intact and lets fetcher form submissions through. Only
    // matters when `HTTPS=1` is set — see the plugins comment above.
    https: process.env.HTTPS === "1" ? { ALPNProtocols: ["http/1.1"] } : undefined,
  },
});
