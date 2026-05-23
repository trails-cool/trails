## Context

trails.cool Journal supports manual route creation and GPX import. Users coming
from Komoot have hundreds of tours they'd lose by switching. The Komoot public
API (`api.komoot.de/v007`) exposes public tours and user profiles without
authentication. Profile fields (`content_text`, `content_link`) are readable
unauthenticated after a short cache delay (~minutes).

> **Note (added 2026-05-08, post `deepen-connected-services`)**:
> Earlier drafts of this design proposed a separate `journal.integrations`
> table for Komoot credentials. That has been **superseded** by the
> connected-services architecture introduced in
> `openspec/changes/deepen-connected-services/`. When this change is
> revisited, Komoot must implement:
>
> - A row in `journal.connected_services` with `credential_kind = 'web-login'`
>   (authenticated mode) or `credential_kind = 'public'` (public mode).
> - A `KomootImporter` in
>   `apps/journal/app/lib/connected-services/providers/komoot/importer.ts`
>   that branches on credential kind.
> - A manifest at `providers/komoot/manifest.ts` registered via
>   `providers/index.ts`.
>
> Don't add a `journal.integrations` table. The user-facing "Connected
> Services" list at `/settings/connections` should show Komoot alongside Wahoo.

## Goals / Non-Goals

**Goals:**
- Public import: verify Komoot profile ownership via bio field, import public tours, store no passwords
- Authenticated import: connect via email + password, import all tours including private
- Import all tours (paginated) as activities + routes
- Track import progress with batch status
- Deduplicate on re-import (same tour never imported twice)
- Fetch GPX geometry per tour (not just metadata)
- Cross-link: store Komoot username on the connection so the Journal profile can show "also on Komoot"

**Non-Goals:**
- OAuth flow
- Real-time sync or webhook-based updates
- Other providers (future iteration)

## Import Modes

### Public mode

No credentials stored. Ownership is verified by checking that the user's
trails.cool profile URL appears in their Komoot `content_text` (bio/"Über dich")
field, which is readable via the unauthenticated public API.

Verification flow:
1. User enters their Komoot profile URL (e.g. `komoot.com/user/27595800585`)
2. trails.cool shows: *"Add your trails.cool profile link (`https://trails.cool/users/ullrich`) to your Komoot bio ('Über dich'), then click Verify"*
3. trails.cool fetches `api.komoot.de/v007/users/{id}/` and checks `content_text` contains their trails.cool profile URL
4. On success: store Komoot username in `connected_services` with `credential_kind = 'public'`, no password
5. Fetch `api.komoot.de/v007/users/{id}/tours/?status=public` (paginated), import

### Authenticated mode

User provides email + password. Credentials validated and stored AES-256-GCM
encrypted. All tours (public and private) imported.

## Decisions

### D1: Two connection modes in `connected_services`

A `mode` column (`'public' | 'authenticated'`) on the connection row controls
which import path runs. Public mode rows have no `encryptedCredentials`.

### D2: Bio field for ownership verification

`api.komoot.de/v007/users/{id}/` returns `content_text` (bio) unauthenticated.
Checking for the user's own trails.cool profile URL proves they control the
Komoot account without any credential exchange. The profile link stays in the
bio permanently, providing cross-platform discovery.

### D3: Import batches for progress tracking

Each import creates a batch row tracking: status, total found, imported count,
duplicate count, error message. UI polls for live progress.

### D4: Deduplication via dedupe key

Activities get a `dedupeKey` of `komoot:{tourId}`. Unique constraint on
`(ownerId, dedupeKey)` prevents duplicates on re-import.

### D5: AES-256-GCM for credential encryption (authenticated mode only)

`INTEGRATION_SECRET` env var → scrypt-derived key. Decrypt on use, never log.

## Risks / Trade-offs

- **Komoot API is undocumented** → Could change without notice. All calls
  wrapped in error handling; connection marked as needing reauth on 401.
- **Public mode: only public tours importable** → Expected and documented.
  Users who want private tours use authenticated mode.
- **Bio field cache delay** → Verification shows a clear "allow a few minutes
  for changes to propagate" message and a retry button.
- **Authenticated mode: storing third-party passwords** → AES-256-GCM,
  separate `INTEGRATION_SECRET`, documented in privacy manifest.
