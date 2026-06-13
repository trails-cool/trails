## 1. Aggregate query

- [ ] 1.1 Add `getActivityStats(ownerId, { publicOnly })` to `activities.server.ts`: one aggregate (`count`, `sum(distance)`, `sum(elevationGain)`, `sum(duration)`) + a `last4Weeks` count (`started_at >= now() - 28d`, COALESCE with `created_at`), scoped by `publicOnly`.
- [ ] 1.2 Return zeros/empty when the owner has no visible activities.

## 2. Loader & view

- [ ] 2.1 Profile loader (`users.$username.server.ts`) calls `getActivityStats(ownerId, { publicOnly: !isOwn })`; expose the totals + last4Weeks.
- [ ] 2.2 Render a compact stats header on `users.$username.tsx` above the routes/activities lists (reuse `StatRow` + `stats.ts` formatters); hide it when there are no activities.

## 3. i18n

- [ ] 3.1 Add `journal.profileStats.*` keys (activities, distance, ascent, time, last4Weeks) to en + de.

## 4. Tests & checks

- [ ] 4.1 Unit/component: the stats header renders totals + last-4-weeks; hidden on empty (jsdom).
- [ ] 4.2 E2E: create activities, assert the profile shows the totals; a visitor sees public-only (a private activity is excluded from the count).
- [ ] 4.3 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
