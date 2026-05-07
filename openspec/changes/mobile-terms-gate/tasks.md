## 1. Implementation

- [x] 1.1 Add `TERMS_OUTDATED: "TERMS_OUTDATED"` to `ERROR_CODES` in `packages/api/src/errors.ts`.
- [x] 1.2 Extend `requireApiUser` in `apps/journal/app/lib/api-guard.server.ts` to compare the authenticated user's `termsVersion` to `TERMS_VERSION` (from `~/lib/legal`). On mismatch (or NULL), throw a `Response` with status 403 and JSON body `{ error, code: ERROR_CODES.TERMS_OUTDATED, currentTermsVersion: TERMS_VERSION }`.

## 2. Tests

- [x] 2.1 Add `apps/journal/app/lib/api-guard.server.test.ts` covering: stale `termsVersion` → 403 with `TERMS_OUTDATED` + `currentTermsVersion`; matching `termsVersion` → returns user; null `termsVersion` → 403; no auth → 401 (unchanged).

## 3. Verification

- [x] 3.1 Run `pnpm typecheck && pnpm lint && pnpm test` — all green.
- [ ] 3.2 Open draft PR against `main`.
