## 1. Komoot API Client

- [x] 1.1 Add `fetchPublicProfile(komootUserId)` to `komoot.server.ts` — unauthenticated GET of `api.komoot.de/v007/users/{id}/`, returns `{ displayName, contentText, contentLink }`
- [x] 1.2 Add `fetchPublicTours(komootUserId, page)` to `komoot.server.ts` — unauthenticated GET with `?status=public&limit=50`
- [x] 1.3 Add `fetchPublicTourGpx(tourId)` — unauthenticated GPX fetch for public tours
- [x] 1.4 Update `KomootCredentials` type to be a discriminated union: `{ mode: 'public'; komootUserId: string } | { mode: 'authenticated'; email: string; encryptedPassword: string; komootUserId: string }`
- [x] 1.5 Update `fetchTours` / `fetchTourGpx` to branch on credential mode (use auth header only in authenticated mode)
- [x] 1.6 Add unit tests for `fetchPublicProfile` response parsing and bio verification logic

## 2. Verification Logic

- [x] 2.1 Add `verifyKomootOwnership(komootUserId, trailsProfileUrl)` in `komoot.server.ts` — fetches public profile, checks `content_text` contains the trails.cool URL (case-insensitive, trimmed)
- [x] 2.2 Write unit tests for verification: match, no match, null bio, trailing slash variations

## 3. Database Schema

- [x] 3.1 Add `mode` column (`'public' | 'authenticated'`) to `journal.sync_connections` (or connected_services table per the connected-services architecture)
- [x] 3.2 Make `encryptedCredentials` nullable (public mode has none)
- [x] 3.3 Run `pnpm db:push` and verify schema locally

## 4. API Routes

- [x] 4.1 Create `POST /api/sync/komoot/verify` — accepts `{ komootProfileUrl }`, calls `verifyKomootOwnership`, on success stores public connection (no credentials)
- [x] 4.2 Create `POST /api/sync/komoot/connect` — authenticated mode; accepts `{ email, password }`
- [x] 4.3 `sync.import.komoot.tsx` — branches on connection mode to use public or authenticated fetch path
- [x] 4.4 Register new routes in `apps/journal/app/routes.ts`

## 5. Import Logic

- [x] 5.1 `importer.ts` accepts the discriminated union credential type and routes to public or authenticated fetch functions accordingly
- [x] 5.2 Credentials stored as discriminated union in connected_services; mode determined from stored credentials

## 6. UI

- [x] 6.1 Add public import section to `/settings/connections/komoot` above the authenticated form: input for Komoot profile URL, instructions showing the user's trails.cool profile URL to copy, Verify button
- [x] 6.2 Show verification state: pending instructions → verifying spinner → success (connected, public) or error with retry
- [x] 6.3 Show mode badge ("Public tours only" vs "All tours") on the connected state UI
- [x] 6.4 Add i18n keys for all new public-mode strings (en + de)

## 7. Privacy

- [x] 7.1 Update `/privacy` page to document both modes: public (stores Komoot username only) and authenticated (stores encrypted password)
