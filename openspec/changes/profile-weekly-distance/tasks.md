## 1. Aggregate query

- [x] 1.1 Added `getWeeklyDistance(ownerId, { publicOnly, weeks = 12 })` to `activities.server.ts`: `sum(distance)` per week, viewer-scoped.
- [x] 1.2 Gap-fill done **in SQL** (`generate_series` of week-starts LEFT JOINed to the activities) — returns exactly N contiguous `{ weekStart, distance }` rows, oldest→newest, and guarantees the week boundaries match Postgres `date_trunc('week', …)` (no JS/Postgres boundary drift). Filter conditions live in the JOIN's ON clause so empty weeks survive.

## 2. Loader & view

- [x] 2.1 Profile loader fetches it in parallel with the stats, same `publicOnly: !isOwn` scoping, only when content is visible.
- [x] 2.2 `WeeklyDistanceChart`: SVG bars normalized to the busiest week, per-bar `title` distance (via `stats.ts`), localized label; renders nothing when every week is 0. Mounted under `ProfileStats`.

## 3. i18n

- [x] 3.1 Added `journal.profileStats.weeklyDistance` (label) to en + de. Per-bar readout is the language-neutral km distance.

## 4. Tests & checks

- [x] 4.1 Gap-fill is in SQL (no JS helper to unit-test) → covered by the e2e (a real activity produces a non-zero bar over a full 12-week axis).
- [x] 4.2 Component (jsdom): one bar per week incl. zero weeks; nothing when all zero; heights normalized to the busiest week.
- [x] 4.3 E2E `profile-weekly-distance.test.ts`: create an activity with distance → the weekly chart renders on the profile. Passes locally.
- [x] 4.4 typecheck + lint + unit (journal 321) green; new e2e passes locally. Full `pnpm test:e2e` runs in CI.
