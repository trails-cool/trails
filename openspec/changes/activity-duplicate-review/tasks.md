## 1. Schema

- [ ] 1.1 Add `activities.suspected_duplicate_of_id` (nullable, FK activities on delete set null) and `import_batches.suspected_duplicate_count` + migration

## 2. Detection

- [ ] 2.1 Implement the overlap heuristic (±120 s start delta, ≥70% interval overlap when durations known) as a pure, unit-tested function
- [ ] 2.2 Wire it into the shared activity-creation path inside the insert transaction (row-locked window query); set the FK on match; increment batch counter for batch imports
- [ ] 2.3 Unit tests: two-provider same ride flagged; back-to-back repeats not flagged; missing startedAt bypasses; concurrent insert race resolves to one flagged copy

## 3. Quarantine enforcement

- [ ] 3.1 Add `suspected_duplicate_of_id IS NULL` to the shared activity-listing scope; audit every query site (feed, listings, profile stats, weekly distance, api.v1 lists, federation outbox, follower notification trigger) to confirm they use the scope
- [ ] 3.2 Owner can open the flagged activity; non-owners get the private-equivalent 404
- [ ] 3.3 Regression test: a flagged activity appears in none of feed / profile stats / API list / outbox, and its follower notification never fires

## 4. Notification + review UI

- [ ] 4.1 New notification type "possible duplicate import" (payload: both activity ids) following the versioned-payload pattern; deep link to the flagged activity
- [ ] 4.2 Review banner on the flagged activity page: side-by-side source/time/duration/distance, keep-both and discard actions (i18n en/de)
- [ ] 4.3 Keep both → clear flag + emit federation Create + follower notification now; Discard → delete flagged copy, retain `sync_imports` row; tests for both paths

## 5. Verification

- [ ] 5.1 E2E: import the same GPX twice via two paths on a seeded account → banner appears → resolve both ways
- [ ] 5.2 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
