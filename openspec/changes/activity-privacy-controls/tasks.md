## 1. Schema

- [ ] 1.1 Add `activities.privacy` jsonb (typed `ActivityPrivacy` four-flag shape, default `{}`) and `users.activity_privacy_defaults` jsonb + migration

## 2. Mask helper

- [ ] 2.1 Implement `applyActivityPrivacyMask` beside `stats.ts`: flag semantics per design (date-truncated start, label removal, geometry/positions stripping, pace/speed/moving-time removal); unit tests per flag and combined
- [ ] 2.2 Stamp defaults in the shared activity-creation path (upload, provider imports, planner handoff); demo bot and fixtures default to `{}`

## 3. Enforcement

- [ ] 3.1 Apply the mask in: activity detail loader, feed/list serializers, `api.v1` activity routes, GPX download route, thumbnail endpoint, elevation-series payload
- [ ] 3.2 Federation: build AP objects through the mask (`federation-objects.server.ts` + outbox); flag edits fire an AP Update; UI copy notes remote copies are best-effort
- [ ] 3.3 Table-driven regression test: fully-flagged fixture requested as non-owner across every activity-serving endpoint → no hidden field present; owner requests → all present

## 4. UI

- [ ] 4.1 Privacy defaults section in settings (four toggles, i18n en/de, copy explains each flag affects future activities)
- [ ] 4.2 Per-activity toggles on the activity edit surface; "hidden from others" indicators on the owner's detail view
- [ ] 4.3 Coordinate with `activity-locations` (label obeys `hideLocation`/`hideMap`) if that change has landed

## 5. Docs & verification

- [ ] 5.1 Update the privacy manifest: per-signal controls exist; federation masking semantics; remote-copy caveat
- [ ] 5.2 E2E: set defaults → import → verify masked view as second user; toggle per-activity flag → verify change
- [ ] 5.3 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
