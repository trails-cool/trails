## Why

Dedup today is per-provider only: `sync_imports` keys on `(provider, externalWorkoutId)`, so re-delivery from the *same* provider is caught. But the same real-world ride can arrive from two sources — Wahoo webhook + Garmin backfill (pending), Komoot import + manual GPX upload — and nothing catches that: the user gets two activities, double distance in weekly stats, and a duplicated feed entry for followers. With Garmin and COROS on the roadmap this will become routine. Endurain's pattern (reviewed 2026-07-06): store the incoming activity anyway, flag it as a suspected duplicate, hide it from all surfaces, and let the user resolve — no silent auto-merge, no data loss.

## What Changes

- On every activity creation from an import path (provider sync, manual upload, Komoot), a **cross-source duplicate check** runs: same owner + overlapping time window (`started_at` within ±2 minutes and durations overlapping ≥ 70%, when both have times).
- A suspected duplicate is stored with `suspectedDuplicateOfId` set and is **excluded from feeds, listings, profile stats, federation, and follower notifications** until resolved.
- The owner gets a "possible duplicate import" notification and a **review UI** showing both activities side by side (source, time, distance, map) with two actions: **keep both** (clears the flag, activity becomes normal) or **discard** (deletes the flagged copy).
- Import batches report suspected duplicates distinctly from exact-ID duplicates (`import_batches.duplicateCount` counts exact; a new counter for suspected).
- Not in scope: auto-merging data from two sources into one activity, retroactive scanning of existing activities, and route (non-activity) dedup.

## Capabilities

### New Capabilities
- `duplicate-detection`: Cross-source duplicate detection on activity import — the heuristic, the quarantine semantics (hidden-from-everything until resolved), the notification, and the resolve flow.

### Modified Capabilities

<!-- none — per-provider dedup requirements in wahoo-import stay as-is; this adds a second, cross-source layer. Feed/stats/federation specs are not contradicted: a quarantined activity is simply not yet published, which their requirements already permit for private content. -->

## Impact

- `packages/db`: `activities.suspected_duplicate_of_id` (nullable text, FK activities, on delete set null); new counter column on `import_batches`.
- All import call sites converge on the shared save path (`gpx-save.server.ts` / activity creation helper) — the check lives once, there.
- Query-layer exclusion: feed, listings, profile stats, weekly distance, federation outbox, follower notifications must filter `suspected_duplicate_of_id IS NULL` (single shared predicate).
- New review UI (activity page banner + notification deep link), notification type, i18n strings.
