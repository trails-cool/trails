## Context

Journal data per user (schema `packages/db/src/schema/journal.ts`): `routes` (GPX text + PostGIS geom + metadata + `route_versions` history), `activities` (GPX text + geom + stats + `photos` paths), `follows`, `notifications`, `connected_services` (encrypted tokens), `sync_imports`/`sync_pushes`, profile fields on `users`. GPX blobs are stored in-DB as text; photos on S3-compatible storage (Garage). Background jobs run via pg-boss (`@trails-cool/jobs`); notifications have an established row + rendering pattern.

Endurain's reference implementation (`export_service.py`) streams a ZIP of JSON dumps plus original uploaded files, memory-bounded, with a matching import service.

## Goals / Non-Goals

**Goals:**
- One action → one ZIP with everything the user owns, GPX as the primary format, JSON only for what GPX can't express.
- Bounded memory regardless of account size; no request-timeout coupling (async job).
- A versioned, documented archive layout a future import can rely on.

**Non-Goals:**
- Import/restore (follow-up change; the manifest version field is its hook).
- Selective/partial export, scheduled exports, or export of other users' content beyond follow handles.
- GDPR legal workflows (this is the technical capability; policy text is separate).

## Decisions

### 1. Archive layout: GPX files first, one manifest for the rest

```
export/
  manifest.json          — format version, generated_at, user profile, counts
  routes/<id>.gpx        — current version
  routes/<id>.versions/<v>.gpx
  routes.json            — per-route metadata (visibility, tags, day breaks, timestamps)
  activities/<id>.gpx
  activities.json        — stats, sport type, visibility, route link, provider provenance
  media/<activity-id>/<file>
  follows.json, notifications.json, connections.json (names + provider only)
```
Open formats carry the payload; JSON carries relations and metadata keyed by the same ids as the filenames. `manifest.json.formatVersion = 1` is the import contract.

### 2. Async job + temporary artifact, not a streaming response

Export runs as a pg-boss job that streams entities from the DB in batches into a ZIP written to the media store (Garage) under an `exports/` prefix with a 7-day expiry; completion fires a notification with a signed, owner-only download URL served through the app (no public bucket URLs). Rationale: accounts with hundreds of GPX blobs exceed sane request lifetimes, and a resumable artifact beats re-generating on a dropped connection.

*Alternative:* synchronous streaming HTTP response — simpler, but ties memory/time to the request and breaks on large accounts; rejected.

### 3. Job bookkeeping in a small table

`export_jobs` (id, user_id, status, artifact_key, error, created_at, expires_at). One active job per user (re-request returns the running job). A daily sweep (existing jobs worker) deletes expired artifacts and rows. Rationale over reusing pg-boss state: the download link must outlive job retention and be queryable by the settings page.

### 4. Exclusions are structural, not filtered

The export queries enumerate included columns explicitly (allowlist per table) rather than dumping rows and deleting secret fields — a new secret column added later can never leak by default. Connected services export as `{provider, connectedAt}` only.

## Risks / Trade-offs

- [Large accounts → big artifacts on Garage] → 7-day expiry + one-active-job cap; size is bounded by the user's own data.
- [Export contains private content in a downloadable file] → owner-only auth on the download route + unguessable artifact key + expiry; the notification link goes through app auth, not a raw bucket URL.
- [Format drifts before import lands] → `formatVersion` + a `docs/export-format.md` page written as part of this change; import will validate the version.

## Migration Plan

Additive: new table (`db:push`/migration), new job, new routes, new settings UI. No changes to existing data. Rollback = revert; sweep removes artifacts.

## Open Questions

- None blocking. Whether the archive should also include a ready-to-serve ActivityPub outbox snapshot (for migration to another instance) is deferred to the import change.
