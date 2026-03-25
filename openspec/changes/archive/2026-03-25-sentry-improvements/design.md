## Context

Both apps have basic Sentry (`@sentry/react` + `@sentry/node`) with source map uploads, release tracking, and environment tagging. Errors appear in Sentry but lack user/session context, making triage slow. Source maps are also served publicly.

## Goals / Non-Goals

**Goals:**
- Identify which user or session caused an error without guessing
- Route-level performance traces (not just page loads)
- Stop serving source maps to browsers

**Non-Goals:**
- Custom Sentry dashboards or alert rules (configure in Sentry UI)
- Server-side performance instrumentation beyond request handling
- Profiling integration

## Decisions

### D1: Set user context via Sentry.setUser in root loader

Journal's root loader already fetches the session user. Call `Sentry.setUser({ id, username })` on the client when authenticated, `Sentry.setUser(null)` when not. Done in root.tsx since it runs on every navigation.

### D2: Tag planner errors with session ID via Sentry.setTag

In `SessionView`, call `Sentry.setTag("session_id", sessionId)` on mount. This tags all subsequent errors with the active session.

### D3: Use reactRouterV7BrowserTracingIntegration

Sentry provides `Sentry.reactRouterV7BrowserTracingIntegration` which hooks into React Router's navigation to create route-aware spans. Replace the generic `browserTracingIntegration()` in both `entry.client.tsx` files. Requires passing `useEffect` and `useLocation` from react-router.

### D4: Hidden source maps via Vite config

Change `build.sourcemap` from `true` to `"hidden"`. This generates `.map` files for the Sentry plugin to upload but doesn't add `//# sourceMappingURL` comments to the bundles. Browsers won't request the map files. The Sentry plugin's `sourcemaps.filesToDeleteAfterUpload` option can also clean them from the build output.

## Risks / Trade-offs

- **D3 couples Sentry to React Router version** → Acceptable; we already depend on both. If we upgrade React Router, we upgrade the Sentry integration too.
- **D4 makes browser debugging harder in production** → Acceptable; errors go to Sentry with full source context. DevTools debugging in production was never a supported workflow.
