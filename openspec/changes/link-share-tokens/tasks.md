## 1. Schema & token core

- [ ] 1.1 Add `share_links` table (resource type+id, owner FK, token hash, label, expiresAt, revokedAt, createdAt, lastUsedAt; cascade on resource delete) + migration
- [ ] 1.2 Token helpers: generate (128-bit base64url), hash, resolve (single indexed lookup, throttled lastUsedAt update); unit tests

## 2. Access integration

- [ ] 2.1 Route + activity detail loaders: accept `?share=` token → non-owner read view for private resources; token echoed to sub-resource fetches (elevation, thumbnail); `noindex` on link-accessed pages
- [ ] 2.2 Compose with privacy mask (if `activity-privacy-controls` landed) and GPX-download rules; regression test: fully-flagged activity via link leaks nothing extra
- [ ] 2.3 Rate-limit token resolution per IP (reuse rate-limiting package); test 429 path
- [ ] 2.4 Verify feeds/listings/search/outbox remain unaffected by link existence (assertion test)

## 3. UI

- [ ] 3.1 "Share links" section in the route/activity share dialog: create (optional expiry + label), one-time token copy, list with created/last-used, revoke (i18n en/de)
- [ ] 3.2 E2E: create link as owner → open in logged-out context → read view renders; revoke → link dead; second link unaffected

## 4. Docs & verification

- [ ] 4.1 Privacy manifest: document share links (what's stored: hash + last-used; query-token-in-logs note)
- [ ] 4.2 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
