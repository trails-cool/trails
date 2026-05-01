## 1. Schema migration

- [x] 1.1 Add `last_pushed_version` (integer, nullable) to `sync_pushes` in the Drizzle schema.
- [x] 1.2 Write a Drizzle migration that backfills `last_pushed_version` from `route_version` for every existing row.
- [x] 1.3 Extend the migration to collapse rows: per `(user_id, route_id, provider)` group, keep the row with the highest `route_version` and delete the rest. If the highest-versioned row failed, keep it (it's still the canonical one under the new key).
- [x] 1.4 Drop the unique constraint that includes `route_version`; add a unique index on `(user_id, route_id, provider)`.
- [x] 1.5 Drop the `route_version` column.
- [x] 1.6 Run the migration locally against a copy of prod data (or a synthesized dataset that has multiple versions) and verify counts.

## 2. Provider plumbing

- [x] 2.1 Extend `wahooProvider.pushRoute` (or add a sibling `updateRoute`) so the wahoo provider exposes a way to PUT against an existing remote id; share the body construction with the POST path.
- [x] 2.2 Treat a 404 response from PUT as a signal to fall back to POST and return the new `remote_id` to the caller.
- [x] 2.3 Update the wahoo provider's unit tests: a successful PUT, a 404 PUT that falls back to a successful POST, and the existing POST/error matrix.

## 3. Push pipeline

- [x] 3.1 In `pushes.server.ts`, look up `sync_pushes` by `(user_id, route_id, provider)` instead of `(…, route_version, …)`.
- [x] 3.2 If the row has a non-null `remote_id`, call the provider's update path; otherwise call the create path.
- [x] 3.3 On success, upsert the row with `last_pushed_version` set to the just-pushed local version, `pushed_at = now()`, `error = null`.
- [x] 3.4 Change `external_id` construction to `route:<route_id>` (drop the `:v<version>` suffix).
- [x] 3.5 Update existing pushes.server tests to assert PUT is used on the second push and that exactly one row exists afterwards.

## 4. UI

- [x] 4.1 Update the route detail page status block to compare `last_pushed_version` with the local route's current version and render the three states (matches, local newer, failed).
- [x] 4.2 i18n: add "On Wahoo (v{{n}}) — local version is newer" and "Send updated version" strings (en + de).
- [ ] 4.3 E2E test: connect Wahoo (mocked), push v1, edit the route to v2, push again, assert the request was a PUT to the same remote id and the UI returns to "Sent to Wahoo on <date>".

## 5. Spec & docs

- [x] 5.1 Verify `openspec validate wahoo-route-update` passes.
- [ ] 5.2 After merge, run `/opsx:archive` to fold the delta into `openspec/specs/wahoo-route-push/spec.md`.
