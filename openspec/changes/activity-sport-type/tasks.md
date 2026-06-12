## 1. Data & contract

- [x] 1.1 Add `SportType` union + `SPORT_TYPES` const to `@trails-cool/db`; add nullable `sportType: text("sport_type").$type<SportType>()` to `journal.activities`.
- [x] 1.2 Apply the additive nullable column to local DBs. (`pnpm db:push` is blocked by an unrelated pre-existing `remote_origin_iri` unique-constraint prompt; applied via a non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to dev + e2e. CI applies schema to a fresh DB.)
- [x] 1.3 Add optional `sportType` to the activity read + create Zod schemas in `packages/api/src/activities.ts` (mirrored `SPORT_TYPES`; api is zod-only/standalone).

## 2. Write path

- [x] 2.1 Add `sportType?: SportType` to `ActivityInput` and persist it in `createActivity` (`apps/journal/app/lib/activities.server.ts`).
- [x] 2.2 Add `mapSportType(raw)` helper with the normalization table; unit-test it (`sport-type.ts` + `sport-type.test.ts`).
- [x] 2.3 Thread `sportType` through the unified `importActivity` input; pass `mapSportType(tour.sport)` from the Komoot bulk import; leave Garmin unset.
- [x] 2.4 Parse the `sportType` form field in `activitiesNewAction` and add the `<select>` to `activities.new.tsx` (optional, i18n labels).

## 3. Read path & display

- [x] 3.1 Add `sportType` to the detail, feed, and profile loaders' activity projections (+ the v1 REST endpoints).
- [x] 3.2 Build a shared `SportBadge` (emoji glyph + i18n label); render it on the detail page, feed cards, and profile list.
- [x] 3.3 Derive the feed verb from the sport (generic fallback when unset).
- [x] 3.4 Add `journal.activities.sport.*` keys (label, per-sport names, per-sport verbs) to en + de.

## 4. Federation

- [x] 4.1 Append a `sport` PropertyValue attachment in `activityToNote()` when set; extend the federation-objects test to assert it (and that it's omitted when unset).

## 5. Tests & checks

- [x] 5.1 Unit: `mapSportType` table (known sports, unknown → `other`, empty → undefined).
- [ ] 5.2 Round-trip (create→detail persists `sportType`) — folded into the E2E below.
- [ ] 5.3 E2E: create an activity with a sport, assert the badge renders on the detail page.
- [ ] 5.4 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green. (typecheck/lint/unit green; e2e pending.)
