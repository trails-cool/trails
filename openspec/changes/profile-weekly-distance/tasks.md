## 1. Aggregate query

- [ ] 1.1 Add `getWeeklyDistance(ownerId, { publicOnly, weeks = 12 })` to `activities.server.ts`: `sum(distance)` grouped by `date_trunc('week', coalesce(started_at, created_at))` over the last `weeks` weeks, viewer-scoped.
- [ ] 1.2 Gap-fill to a contiguous oldest→newest series with `0` for empty weeks; return `{ weekStart, distance }[]`.

## 2. Loader & view

- [ ] 2.1 Profile loader passes the series (same `publicOnly: !isOwn` scoping; only when content is visible).
- [ ] 2.2 `WeeklyDistanceChart` component: SVG bars normalized to the max week, per-bar `title` distance (via `stats.ts`), localized label; renders nothing when every week is 0. Mount under `ProfileStats`.

## 3. i18n

- [ ] 3.1 Add `journal.profileStats.weeklyDistance*` (label + per-bar readout) to en + de.

## 4. Tests & checks

- [ ] 4.1 Unit: gap-fill produces 12 contiguous weeks with zeros in the right slots.
- [ ] 4.2 Component (jsdom): renders 12 bars for a series; nothing when all zero; tallest bar = busiest week.
- [ ] 4.3 E2E: create activities, assert the weekly chart renders on the profile.
- [ ] 4.4 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
