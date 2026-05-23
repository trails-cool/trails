## 1. Komoot API Client

- [ ] 1.1 Add `fetchPublicProfile(komootUserId)` to `komoot.server.ts` — unauthenticated GET of `api.komoot.de/v007/users/{id}/`, returns `{ displayName, contentText, contentLink }`
- [ ] 1.2 Add `fetchPublicTours(komootUserId, page)` to `komoot.server.ts` — unauthenticated GET with `?status=public&limit=50`
- [ ] 1.3 Add `fetchPublicTourGpx(tourId)` — unauthenticated GPX fetch for public tours
- [ ] 1.4 Update `KomootCredentials` type to be a discriminated union: `{ mode: 'public'; username: string } | { mode: 'authenticated'; email: string; password: string; username: string; token: string }`
- [ ] 1.5 Update `fetchTours` / `fetchTourGpx` to branch on credential mode (use auth header only in authenticated mode)
- [ ] 1.6 Add unit tests for `fetchPublicProfile` response parsing and bio verification logic

## 2. Verification Logic

- [ ] 2.1 Add `verifyKomootOwnership(komootUserId, trailsProfileUrl)` in `komoot.server.ts` — fetches public profile, checks `content_text` contains the trails.cool URL (case-insensitive, trimmed)
- [ ] 2.2 Write unit tests for verification: match, no match, null bio, trailing slash variations

## 3. Database Schema

- [ ] 3.1 Add `mode` column (`'public' | 'authenticated'`) to `journal.sync_connections` (or connected_services table per the connected-services architecture)
- [ ] 3.2 Make `encryptedCredentials` nullable (public mode has none)
- [ ] 3.3 Run `pnpm db:push` and verify schema locally

## 4. API Routes

- [ ] 4.1 Create `POST /api/integrations/komoot/verify` — accepts `{ komootProfileUrl }`, calls `verifyKomootOwnership`, on success stores public connection (no credentials)
- [ ] 4.2 Update `POST /api/integrations/komoot/connect` — now handles authenticated mode only; accepts `{ email, password }`
- [ ] 4.3 Update `POST /api/integrations/komoot/import` — branches on connection mode to use public or authenticated fetch path
- [ ] 4.4 Register new verify route in `apps/journal/app/routes.ts`

## 5. Import Logic

- [ ] 5.1 Update `importKomootTours` in `komoot-import.server.ts` to accept the discriminated union credential type and route to public or authenticated fetch functions accordingly
- [ ] 5.2 Update `komootImportJob` background job handler to reconstruct credentials as `{ mode: 'public', username }` when `encryptedCredentials` is null

## 6. UI

- [ ] 6.1 Add public import section to `/integrations` page above the authenticated form: input for Komoot profile URL, instructions showing the user's trails.cool profile URL to copy, Verify button
- [ ] 6.2 Show verification state: pending instructions → verifying spinner → success (connected, public) or error with retry
- [ ] 6.3 Show mode badge ("Public tours only" vs "All tours") on the connected state UI
- [ ] 6.4 Add i18n keys for all new public-mode strings (en + de)

## 7. Privacy

- [ ] 7.1 Update `/privacy` page to document both modes: public (stores Komoot username only) and authenticated (stores encrypted password)
