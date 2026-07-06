## Context

Activity creation happens through several paths — Wahoo webhook/manual import, Komoot import, manual GPX upload, and soon Garmin backfill — all converging on the gpx-save layer. Per-provider dedup (`sync_imports` unique on provider + external id) prevents same-source re-imports; `import_batches` counts those. Nothing compares *across* sources. Activities carry `startedAt` (nullable — planned-route-style uploads may lack it) and `duration`. Feeds/stats/federation currently filter by `visibility` and `synthetic`.

Endurain's reference: exact same-start-time match → store with `is_hidden=true` + notification for manual review. We adopt the pattern but widen the match window (devices disagree by seconds) and tighten the quarantine semantics.

## Goals / Non-Goals

**Goals:**
- The same physical activity arriving twice never double-counts in stats or appears twice to followers — without silently discarding data the user may want.
- One detection point, one exclusion predicate — impossible for a new surface to forget the filter accidentally... (see risk).
- Resolution is a two-tap user decision.

**Non-Goals:**
- Merging (picking best-of fields from both copies).
- Geometry-similarity matching (same route ≠ same activity; time overlap is the honest signal).
- Retroactive dedup of pre-existing rows (could be a later one-shot job).
- Route dedup.

## Decisions

### 1. Heuristic: time overlap, not exact equality

Suspect when same owner AND both have `startedAt` AND |Δstart| ≤ 120 s AND (if both have durations) the intervals overlap ≥ 70%. Rationale: Garmin and Wahoo timestamps for one ride differ by GPS-fix seconds; exact equality (Endurain) misses those, while a bare ±2 min window without overlap check would false-positive back-to-back track repeats. Activities without `startedAt` are never suspected (nothing to compare).

*Alternative:* geometry proximity — rejected as both expensive and wrong (riding the same loop twice is two activities).

### 2. Quarantine = a self-referential FK, filtered everywhere via one predicate

`activities.suspected_duplicate_of_id` references the *earlier* activity. A shared query helper (e.g. `visibleActivities()` scope used by feed/listings/stats/outbox) gains `AND suspected_duplicate_of_id IS NULL`. The activity detail page remains reachable by the owner (that's the review surface); non-owners get 404 as if private. Federation: the Create is simply not emitted while quarantined; on "keep both", normal publish fires then.

*Alternative:* reuse `visibility='private'` + a reason column — rejected: it would destroy the user's chosen visibility (which must survive "keep both") and overload a user-facing concept with system state.

### 3. Resolution actions

Banner on the activity page (and notification deep-link): shows both copies' source (provider from `sync_imports`/upload), start time, duration, distance. **Keep both** → clear the FK; activity publishes with its original visibility (federation Create fires now). **Discard** → hard-delete the flagged copy (its `sync_imports` row remains, so the provider won't re-import it). The *original* activity is never touched.

### 4. Detection lives in the shared save path

The check runs inside the same transaction as activity insert for import-shaped creations (provider imports, uploads). Planner-saved activities don't exist (planner saves routes), so no exclusions needed. Import batches increment a new `suspectedDuplicateCount`.

## Risks / Trade-offs

- [A forgotten surface still shows quarantined rows] → The exclusion lives in the shared activity-listing helper; the task list includes an audit of every query site + a regression test that a quarantined activity is absent from feed, profile, stats, API list, and outbox.
- [False positives annoy users (e.g. two people's devices on one account)] → Both copies survive; resolution is one tap; the window is deliberately tight.
- [Race: two imports in parallel create both copies with neither flagged] → Detection query runs `FOR UPDATE` on the owner's recent-activity window inside the insert transaction; worst case (different processes) is caught by whichever commits second.
- [Nullable startedAt uploads bypass detection] → Accepted; without a timestamp there is no honest signal, and manual uploads are user-intentional.

## Migration Plan

Additive column + index (`owner_id, started_at` index already exists). Ship detection + exclusion + UI together. Rollback = revert; quarantined rows become visible again (harmless).

## Open Questions

- None blocking. A retroactive scan job for existing duplicates can be a follow-up once the review UI exists.
