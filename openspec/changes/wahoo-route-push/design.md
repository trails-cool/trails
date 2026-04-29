## Context

The Journal already runs a one-way sync with Wahoo: webhooks deliver `workout_summary` events, we download the FIT, decode it with `fit-file-parser`, and store a Journal activity. The Planner emits GPX as the route exchange format and the Journal stores route geometry as PostGIS LineStrings (see `apps/journal/app/lib/sync/providers/wahoo.ts`, `apps/journal/db/schema.ts`).

Wahoo's `POST /v1/routes` accepts a base64-encoded FIT **Course** file (different message profile from a workout/activity) plus `external_id`, `provider_updated_at`, `name`, `workout_type_family_id`, `start_lat`, `start_lng`, `distance`, `ascent`, optionally `description`, `descent`, `filename`. The OAuth scope `routes_write` is required, which the existing connection does not hold. Wahoo confirms routes uploaded this way reach the Wahoo App and ELEMNT/BOLT/ROAM head units; only the legacy ELEMNT App does not see them.

There is no FIT *encoder* in the repo today — we only decode. FIT Course encoding is the one piece of real engineering in this change; everything else is plumbing on top of the existing sync framework.

## Goals / Non-Goals

**Goals:**
- One-tap "Send to Wahoo" on the route detail page that lands the route on the user's bike computer.
- A reusable `@trails-cool/fit` package so future providers (Garmin Connect, Hammerhead) can share the encoder.
- Idempotent server-side pipeline that records what was pushed, detects re-pushes, and surfaces a clear "Sent to Wahoo" status in the UI.
- Clean re-auth flow when an existing user lacks `routes_write` — no silent scope upgrades, no broken pushes.

**Non-Goals:**
- Bulk push ("send all my routes") — out of scope until single-route push is solid.
- Auto-push on route save — push is always an explicit user action.
- Pushing route updates after the first send (`PUT /v1/routes/:id`) — first send wins; updates require a fresh push from the user. We can revisit once we have telemetry on whether users actually edit routes after pushing.
- Provider-agnostic UI — the button reads "Send to Wahoo". When a second push provider lands we'll generalize.
- Cue sheets / turn-by-turn instructions in the FIT Course — Wahoo head units generate these from the geometry on-device.

## Decisions

### 1. Use a hand-rolled FIT Course encoder, not the official Garmin SDK

**Decision**: Add a small (~300 LOC) hand-rolled FIT encoder to `packages/fit/` that emits exactly the message types Wahoo needs for a Course: `file_id`, `file_creator`, `course`, `lap`, `event` (start/stop), and `record`. No dependency on Garmin's SDK.

**Why**:
- `@garmin/fitsdk-javascript` is the official option but ships ~1 MB of profile metadata and a CommonJS-only build that fights our ESM/Vite setup. Pulling it into the journal bundle is wasteful when we use ~5 message types.
- `fit-file-writer` (npm) is the closest community option, but unmaintained since 2021 and ships TypeScript types that disagree with the runtime API. We'd be patching it on day one.
- The FIT binary format is a documented, stable protocol (header + variable-length records + CRC). Encoding the seven messages we need is small enough to own.
- `fit-file-parser` (used today on the import path) gives us a free correctness oracle: every encoded file gets round-tripped through the parser in tests and asserted to match the source GPX track points.

**Alternatives considered**: `@garmin/fitsdk-javascript` (rejected: bundle size, ESM friction), `fit-file-writer` (rejected: unmaintained), shelling out to the Python `fit-tool` (rejected: adds a runtime dependency on the deploy host that doesn't already exist).

### 2. New `packages/fit/` package, GPX-shaped public API

**Decision**: Public API of `@trails-cool/fit` is one function:

```ts
export function gpxToFitCourse(input: {
  gpx: string;
  name: string;
  description?: string;
  sport?: "cycling" | "running" | "hiking";
}): Uint8Array;
```

**Why**: Keeps the boundary at the format level, not at internal FIT message records. Future providers (Garmin) will accept the same FIT Course bytes; only the upload call differs. The package is provider-agnostic by construction.

### 3. Idempotency keyed on `(user_id, route_id, route_version, provider)`

**Decision**: New `journal.sync_pushes` table:

```
sync_pushes (
  id              uuid pk,
  user_id         uuid not null,
  route_id        uuid not null,
  route_version   int  not null,
  provider        text not null,         -- 'wahoo'
  external_id     text not null,         -- our own UUID, stable per (route, version)
  remote_id       text,                  -- Wahoo's route id, populated on success
  pushed_at       timestamptz,
  error           text,                  -- last error if push failed
  unique (user_id, route_id, route_version, provider)
)
```

The `external_id` we send to Wahoo is `route:<route_id>:v<version>` — deterministic, so two attempts to push the same route version produce the same `external_id` and Wahoo's de-dup applies if our own check ever races. The user-facing rule: each *version* of a route can be pushed once per provider. Editing the route bumps the version (existing behavior in `route-management`) and unlocks a fresh push.

### 4. Re-auth on scope upgrade is explicit, not silent

**Decision**: The first time a user with a pre-`routes_write` connection clicks "Send to Wahoo", the action route detects the missing scope (we store `granted_scopes` on the connection) and redirects through `getAuthUrl` again with the full new scope set, preserving a `?return_to=<route_url>&push_after=1` query param. After re-auth, the route action runs the push automatically.

**Why**: A silent scope upgrade isn't possible with OAuth — providers always re-prompt for new scopes — but we want the UX to feel like one click. Storing `granted_scopes` lets us detect the mismatch *before* hitting Wahoo and getting a 403, which is faster and gives us a clean redirect target.

**Alternative considered**: Re-prompt all existing users at next login. Rejected: too noisy for users who never push routes.

### 5. Privacy: route name + description + geometry leave the system on push

**Decision**: Update `docs/privacy.md` to state that when a user clicks "Send to Wahoo", the route's geometry, name, and description are transmitted to Wahoo and become subject to Wahoo's privacy policy. The push button copy includes "This sends your route to Wahoo" so the disclosure is at the action point, not buried in settings.

**Why**: Matches the privacy-first principle in CLAUDE.md. The push is opt-in per route, so no surprise data egress.

## Risks / Trade-offs

- **FIT Course encoder bugs send unusable files to bike computers** → Mitigation: round-trip every encoded file through `fit-file-parser` in tests and assert track-point parity with the input GPX. Add a fixture set of real-world routes (short, long, with/without elevation, multi-day) to `packages/fit/__fixtures__/` and snapshot the round-trip output. Manual smoke test on at least one ELEMNT before merging.
- **Wahoo API rate limits unknown** → Mitigation: log every push outcome to `sync_pushes.error`. If we observe rate limiting in dev, add a per-user 1-push-per-second throttle. Defer until observed.
- **Routes without GPS geometry can't be pushed** (e.g. a route created from a handwritten description) → Mitigation: button is hidden when `route.geojson` is null; action route 422s with a clear message if it slips through.
- **Wahoo deletes a pushed route on their side** → We don't reconcile. Re-pushing requires editing the route to bump the version. Acceptable for v1; revisit if it's a real complaint.
- **`routes_write` scope rejection by Wahoo for new OAuth apps** → Wahoo's docs don't gate this scope behind a partner agreement, but if they do reject our app, we'd be stuck. Mitigation: confirm via a test push from a dev sandbox before announcing the feature externally.
- **GPX-only routes lose Planner-specific metadata** (e.g. routing profile, no-go avoidance) → Acceptable; FIT Course only carries geometry. Wahoo head unit does its own re-routing if the rider deviates.

## Migration Plan

1. Ship `@trails-cool/fit` with no consumer; verify CI passes the round-trip tests.
2. Apply the `sync_pushes` migration (additive — no risk to existing rows).
3. Update Wahoo provider scopes and ship the re-auth detection. No behavioral change for users who never click "Send to Wahoo".
4. Ship the action route + UI button. Feature is gated only by the user clicking it.
5. After 2 weeks in production, review `sync_pushes.error` distribution, decide whether to expose the bulk push or auto-push affordances.

No rollback drama — the change is additive (new column, new package, new route). If `gpxToFitCourse` turns out to be broken, hide the button (one-line UI flag) while we fix the encoder.

## Open Questions

- Wahoo's `workout_type_family_id` mapping: 0 is "Cycling" per their docs, but we should confirm the running/hiking values before exposing them. For v1 we hardcode cycling.
- Does Wahoo's `provider_updated_at` need to monotonically increase per `external_id`? If so, our deterministic per-version `external_id` might cause issues if a user pushes v2 of a route created earlier the same second. Test before launch.
- Should the `description` field include a "Routed by trails.cool — <route URL>" footer? Nice for attribution but invades user content. Default to no footer for v1.
