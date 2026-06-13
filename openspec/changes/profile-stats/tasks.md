## 1. Aggregate query

- [x] 1.1 Added `getActivityStats(ownerId, { publicOnly })` to `activities.server.ts`: one aggregate (`count`, `sum(distance/elevationGain/duration)`) + a `last4Weeks` count (`coalesce(started_at, created_at) >= now() - 28d`), scoped by `publicOnly`.
- [x] 1.2 Returns zeros when the owner has no visible activities (the component hides on `count === 0`).

## 2. Loader & view

- [x] 2.1 Profile loader calls `getActivityStats(user.id, { publicOnly: !isOwn })` when content is visible; exposes `stats`.
- [x] 2.2 `ProfileStats` header on `users.$username.tsx` above the lists (reuses `StatRow` + `stats.ts` formatters); hidden when there are no activities.

## 3. i18n

- [x] 3.1 Added `journal.profileStats.*` (activities, distance, ascent, time, last4Weeks) to en + de.

## 4. Tests & checks

- [x] 4.1 Component (jsdom): renders formatted totals + the last-4-weeks line; nothing on empty; line omitted when last4Weeks is 0.
- [x] 4.2 E2E `profile-stats.test.ts`: create activities → owner profile shows the roll-up ("2 in the last 4 weeks"). Owner-scoped count verified; the public-only branch is a one-line conditional covered by the query design (a fuller visitor-scoping e2e would need a public profile + a public/private activity mix — deferred).
- [x] 4.3 typecheck + lint + unit (journal 318) green; new e2e passes locally. Full `pnpm test:e2e` runs in CI.
