## Why

Sentry is deployed but errors lack context — we don't know which user or session triggered them, route-level performance is invisible, and source maps are served to clients unnecessarily. These gaps make debugging harder and leak internal details.

## What Changes

- Set Sentry user context when a Journal user is authenticated (user ID, username)
- Tag Planner errors with the session ID for debugging
- Replace generic `browserTracingIntegration` with `reactRouterV7BrowserTracingIntegration` for route-aware performance traces
- Configure Vite to produce source maps as `hidden` (uploaded to Sentry but not referenced in the bundle, so browsers don't fetch them)
- Wrap server-side request handlers with Sentry error capturing for unhandled exceptions

## Capabilities

### New Capabilities

(None — this enhances the existing Sentry integration, no new behavioral capabilities.)

### Modified Capabilities

- `infrastructure`: Adding Sentry context enrichment and source map handling to the deployment pipeline

## Impact

- **Files**: `entry.client.tsx` (both apps), `entry.server.tsx` (journal), `server.ts` (planner), `vite.config.ts` (both apps), Journal root loader or layout
- **Dependencies**: No new packages — `@sentry/react` and `@sentry/node` already support all features
- **APIs**: No API changes
- **Security**: Source maps no longer served to clients (currently `.map` files are publicly accessible)
