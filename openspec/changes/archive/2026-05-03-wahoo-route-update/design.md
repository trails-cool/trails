## Context

`wahoo-route-push` currently POSTs each route version as a fresh route. The push pipeline:

1. Looks up `sync_pushes` keyed by `(user_id, route_id, route_version, provider)`.
2. If a successful row exists for the exact version, returns the existing `remote_id` (no-op).
3. Otherwise calls `wahooProvider.pushRoute()` which always `POST`s `/v1/routes` with `external_id = route:<routeId>:v<version>`.

Wahoo confirmed in their docs that POST with a duplicate `external_id` does *not* update — only `PUT /v1/routes/:id` does. So even though our `external_id` is "stable per version", it does not help us update across versions; the second push of the same version is the only thing it dedupes (which is also already covered by our local `sync_pushes` check).

The user-visible problem is exactly the case the current spec doesn't address: re-pushing a *new* version. Today that creates a duplicate Wahoo route. We need to detect "we already have a remote_id for this route" and PUT to it.

## Goals / Non-Goals

**Goals:**
- After this change, editing a route locally and re-pushing it updates the Wahoo route in place: same Wahoo URL, same id in the Wahoo app, just refreshed track and metadata.
- Idempotency for retrying a failed push of the *same* version still works.
- Existing successfully-pushed routes (one row per old version on our side) collapse cleanly to one row per logical route without losing the `remote_id` of the most recent push.

**Non-Goals:**
- Not changing how the user triggers a push (button stays the same).
- Not deleting old Wahoo routes that were already duplicated by previous behavior — users can clean those up in the Wahoo app. We just stop creating new duplicates.
- Not generalizing this to other providers — the sync framework allows per-provider update semantics, but only Wahoo needs it now.

## Decisions

**Switch idempotency key from `(user, route, version, provider)` to `(user, route, provider)`.** A logical Wahoo route is per-route, not per-version. The version that's currently on Wahoo is a property of that row (`last_pushed_version`), not a key. This matches the new "PUT or POST" branching we need.

**Send `external_id = route:<routeId>` (drop the version suffix).** The `external_id` is meant to be a stable third-party id; "the route" is what's stable, not "this exact edit of the route". This also makes the data correct if a future Wahoo behavior change starts respecting `external_id` for upserts.

**POST on first push, PUT on subsequent pushes.** Decision rule:
- If there's no `sync_pushes` row for `(user, route, provider)` → POST `/v1/routes` (and store the returned `remote_id`).
- If a row exists with a non-null `remote_id` → PUT `/v1/routes/<remote_id>`.
- If a row exists with a null `remote_id` (previous push failed) → POST again, just like a fresh push.

If a PUT returns 404 (the user deleted the Wahoo route from their side), fall back to POST and overwrite `remote_id`. This keeps the system self-healing.

**Version handling on the row.** The single `sync_pushes` row tracks `last_pushed_version` (integer) and `pushed_at` (timestamp). The route detail page compares `last_pushed_version` to the local `routes.current_version`:
- equal → "On Wahoo (vN, sent at …)"
- local newer → "On Wahoo (vN-1) · Send updated version"
- local older (shouldn't happen, but…) → fall back to the equal case.

**Migration: collapse existing rows.** For each `(user_id, route_id, provider='wahoo')` group, keep only the row with the highest `route_version` and copy that version into the new `last_pushed_version` column. Drop the rest. Failed rows for already-pushed routes are dropped entirely (they're not reachable for retry under the new key anyway). No external Wahoo state changes — the `remote_id`s on the kept rows are still the live Wahoo route ids.

## Risks / Trade-offs

- **[Risk] Wahoo's PUT requires fields we currently send on POST (e.g., file, name, distance) and rejects partials silently.**
  Mitigation: send the same body shape we send on POST. Test against a real Wahoo account before flipping the default.
- **[Risk] PUT against a deleted Wahoo route returns 404 and confuses the user.**
  Mitigation: catch 404, fall back to POST automatically, log the recovery. Already in the decision rule.
- **[Risk] Schema migration deletes a sync_pushes row a user might want to retry.**
  Mitigation: only collapse rows where the *highest-versioned* row was successful. If the highest version's row failed, keep that row (it's still the canonical one under the new key) and drop only strictly older rows.
- **[Trade-off] We lose per-version visibility ("which of my edits made it to Wahoo and when").**
  Acceptable: the route detail page is already version-aware locally, and Wahoo doesn't store our versions, only its own copy. If we ever want a full push history, add a `sync_push_log` table later.

## Migration Plan

1. Add `last_pushed_version` column to `sync_pushes` (nullable initially).
2. Backfill `last_pushed_version` from the existing `route_version` column on each row.
3. Collapse rows: per `(user, route, provider)` group, keep the highest-version row, delete the rest.
4. Drop the `route_version` column from the unique constraint, add a unique index on `(user_id, route_id, provider)`.
5. Drop the `route_version` column itself.
6. Ship the code change to send PUT instead of POST when a `remote_id` exists.

This is one Drizzle migration. The old code path (per-version rows) and new code path (per-route rows) cannot coexist on the same DB, so we ship migration + code change together.

## Open Questions

- Does Wahoo's PUT response include the same fields as POST (`id`, etc.) so we can keep the same parsing path? Likely yes — sanity-check during implementation.
