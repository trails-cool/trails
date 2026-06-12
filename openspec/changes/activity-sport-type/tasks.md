## 1. Data & contract

- [ ] 1.1 Add `SportType` union + `SPORT_TYPES` const to `@trails-cool/db`; add nullable `sportType: text("sport_type").$type<SportType>()` to `journal.activities`.
- [ ] 1.2 `pnpm db:push` against the local DB (additive nullable column, no data migration).
- [ ] 1.3 Add optional `sportType` to the activity read + create Zod schemas in `packages/api/src/activities.ts`.

## 2. Write path

- [ ] 2.1 Add `sportType?: SportType` to `ActivityInput` and persist it in `createActivity` (`apps/journal/app/lib/activities.server.ts`).
- [ ] 2.2 Add `mapSportType(raw: string): SportType` helper with the normalization table; unit-test it.
- [ ] 2.3 Thread `sportType` through the unified `importActivity` input; pass `mapSportType(tour.sport)` from the Komoot bulk import; leave Garmin unset.
- [ ] 2.4 Parse the `sportType` form field in `activitiesNewAction` and add the `<select>` to `activities.new.tsx` (optional, i18n labels).

## 3. Read path & display

- [ ] 3.1 Add `sportType` to the detail, feed, and profile loaders' activity projections.
- [ ] 3.2 Build a shared `SportBadge` (inline-SVG icon + i18n label); render it on the detail page, feed cards, and profile list.
- [ ] 3.3 Derive the feed verb from the sport (generic fallback when unset).
- [ ] 3.4 Add `journal.activities.sport.*` keys (label, per-sport names, per-sport verbs) to en + de.

## 4. Federation

- [ ] 4.1 Append a `sport` PropertyValue attachment in `activityToNote()` when set; extend the federation-outbox test to assert it.

## 5. Tests & checks

- [ ] 5.1 Unit: `mapSportType` table (known sports, unknown → `other`, empty → `other`).
- [ ] 5.2 Unit/integration: create→detail round-trip persists and returns `sportType`.
- [ ] 5.3 E2E: create an activity with a sport, assert the badge renders on the detail page.
- [ ] 5.4 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
