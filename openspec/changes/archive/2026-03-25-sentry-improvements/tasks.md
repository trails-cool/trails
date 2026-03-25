## 1. User & Session Context

- [x] 1.1 Set Sentry user context (id, username) in Journal root loader/component when authenticated, clear when not
- [x] 1.2 Set Sentry `session_id` tag in Planner's SessionView on mount

## 2. Route-Aware Tracing

- [x] 2.1 Replace `browserTracingIntegration()` with `reactRouterV7BrowserTracingIntegration` in planner entry.client.tsx
- [x] 2.2 Replace `browserTracingIntegration()` with `reactRouterV7BrowserTracingIntegration` in journal entry.client.tsx

## 3. Source Map Hardening

- [x] 3.1 Change `build.sourcemap` from `true` to `"hidden"` in both vite.config.ts files
- [x] 3.2 Add `sourcemaps.filesToDeleteAfterUpload` to the Sentry Vite plugin config to clean up .map files after upload

## 4. Privacy Manifest

- [x] 4.1 Create `/privacy` route in Journal with a user-visible privacy manifest documenting: what Sentry collects (errors, traces, session replays), what the Planner does NOT collect, data retention, and third-party disclosure (Sentry)
- [x] 4.2 Add link to privacy manifest in Journal footer/home page

## 5. Verify

- [x] 5.1 Test locally: build, check no `.map` files remain in build output (or no sourceMappingURL in bundles)
- [x] 5.2 Test locally: trigger error in Journal while logged in, verify Sentry.setUser was called (check devtools)
