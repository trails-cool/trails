# Capabilities Index

Top-level index of every spec under `openspec/specs/`, grouped by area. Each spec describes a capability the platform exposes (or supports internally). Use this as the entry point when navigating the spec library — the alphabetical directory listing is fine for grep, but groupings make it easier to spot drift, overlap, and coverage gaps.

When adding a new spec, slot it into the most relevant group below and update this index in the same change. When merging or splitting specs, update both the directory and this index in the same change.

## Identity & access

- [`journal-auth`](specs/journal-auth/spec.md) — cookie session, terms-of-service consent gate (initial accept + re-accept on version bump).
- [`authentication-methods`](specs/authentication-methods/spec.md) — passkeys (WebAuthn), magic links, 6-digit codes, the method toggle on register/login forms.
- [`security-hardening`](specs/security-hardening/spec.md) — cross-cutting hardening (CSP, headers, rate-limit-adjacent concerns).
- [`rate-limiting`](specs/rate-limiting/spec.md) — per-route rate-limit policy.

## Profile & settings

- [`profile-settings`](specs/profile-settings/spec.md) — display name, bio, profile-visibility editing UX.
- [`account-management`](specs/account-management/spec.md) — email change with re-verification, account deletion (irreversible, cascades).
- [`connected-services`](specs/connected-services/spec.md) — third-party integrations (Wahoo today; Strava, Garmin later) connected from settings.
- [`public-profiles`](specs/public-profiles/spec.md) — `/users/:username` page (full vs. locked stub), open-graph metadata.

## Social

- [`social-follows`](specs/social-follows/spec.md) — follow API, follower/following collections (with locked-account access rules), Pending request lifecycle, `/feed`.
- [`activity-feed`](specs/activity-feed/spec.md) — the `/feed` aggregation behavior (note: also referenced from `social-follows`; this spec covers feed-specific concerns).
- [`explore`](specs/explore/spec.md) — `/explore` page: paginated local user directory (public profiles only) ordered by recent public activity, plus an "Active recently" sub-section. Reachable to both signed-in users and anonymous visitors.

## Notifications & realtime

- [`notifications`](specs/notifications/spec.md) — `notifications` table, four event types (follow_request_received / follow_request_approved / follow_received / activity_published), generation hooks, fan-out, `/notifications` page with cursor pagination, mark-read APIs, 90-day retention.
- [`sse-broker`](specs/sse-broker/spec.md) — `/api/events` endpoint, in-process pub/sub registry, client `EventSource` hook, Caddy passthrough. Transport-only; specific event payloads are owned by the capability that emits them (notifications today).

## Routes (Planner core)

- [`planner-session`](specs/planner-session/spec.md) — anonymous Yjs session lifecycle.
- [`session-notes`](specs/session-notes/spec.md) — per-session shared notes.
- [`route-management`](specs/route-management/spec.md) — CRUD around saved routes.
- [`route-preview`](specs/route-preview/spec.md) — preview rendering of saved routes.
- [`route-drag-reshape`](specs/route-drag-reshape/spec.md) — drag-to-reshape interaction.
- [`route-splitting`](specs/route-splitting/spec.md) — split routes at points.
- [`route-coloring`](specs/route-coloring/spec.md) — generic line color modes.
- [`road-type-coloring`](specs/road-type-coloring/spec.md) — road-type-specific color mode.
- [`elevation-map-interaction`](specs/elevation-map-interaction/spec.md) — hover-to-locate between elevation chart and map.
- [`multi-day-routes`](specs/multi-day-routes/spec.md) — overnight markers + per-day export.
- [`no-go-areas`](specs/no-go-areas/spec.md) — drawn polygons that re-route avoidance.
- [`crash-recovery`](specs/crash-recovery/spec.md) — recovering an interrupted session.
- [`planner-journal-handoff`](specs/planner-journal-handoff/spec.md) — JWT-callback save flow back to Journal.

## Routing engine

- [`brouter-integration`](specs/brouter-integration/spec.md) — BRouter container + routing-host election + the API the client expects.

## Map / overlays

- [`map-core`](specs/map-core/spec.md) — shared Leaflet wrappers in `@trails-cool/map`.
- [`map-display`](specs/map-display/spec.md) — base-tile selection and rendering.
- [`osm-tile-overlays`](specs/osm-tile-overlays/spec.md) — OSM raster overlays.
- [`osm-poi-overlays`](specs/osm-poi-overlays/spec.md) — POI overlay layer.

## Imports & exports

- [`gpx-import`](specs/gpx-import/spec.md) — GPX file parsing and route ingestion.
- [`wahoo-import`](specs/wahoo-import/spec.md) — Wahoo activity sync rules.
- [`wahoo-route-push`](specs/wahoo-route-push/spec.md) — pushing routes to Wahoo (POST on first push, PUT on re-push, stable `external_id`, push-status UI).

## Journal landing & content

- [`journal-landing`](specs/journal-landing/spec.md) — anonymous landing + signed-in personal dashboard.
- [`activity-sport-type`](specs/activity-sport-type/spec.md) — sport/activity-type enum on activities (set on create or normalized on import), shown as a badge + feed verb, federated as a Note PropertyValue.
- [`activity-stats`](specs/activity-stats/spec.md) — the canonical headline metric set + reusable stat row (sport-aware avg pace/speed, moving-vs-elapsed time) across feed, detail, and profile.
- [`journal-elevation-profile`](specs/journal-elevation-profile/spec.md) — read-only elevation profile chart + chart↔map "active distance" hover/click sync on the route & activity detail pages.
- [`profile-stats`](specs/profile-stats/spec.md) — profile roll-up header (lifetime totals + last-4-weeks count), viewer-scoped, computed on the fly (no cache table).
- [`profile-weekly-distance`](specs/profile-weekly-distance/spec.md) — weekly distance bar chart on the profile (12-week axis, gridlines, hover readout), SQL gap-filled.
- [`legal-disclaimers`](specs/legal-disclaimers/spec.md) — Terms / Privacy / Imprint pages.
- [`transactional-emails`](specs/transactional-emails/spec.md) — magic-link, welcome, etc. email templates.
- [`demo-activity-bot`](specs/demo-activity-bot/spec.md) — synthetic-content bot (Bruno by default) seeded for demo instances; configurable persona, retention, and seed region.

## Infrastructure & ops

- [`infrastructure`](specs/infrastructure/spec.md) — Hetzner host topology, Caddy front, vSwitch.
- [`local-dev-environment`](specs/local-dev-environment/spec.md) — `pnpm dev` orchestration, Docker services.
- [`secret-management`](specs/secret-management/spec.md) — SOPS-encrypted env files, key rotation.
- [`observability`](specs/observability/spec.md) — Prometheus, Loki, Grafana dashboards.
- [`background-jobs`](specs/background-jobs/spec.md) — pg-boss queue, cron scheduling, retry policy, handler timeouts shared across the apps.
- [`shared-packages`](specs/shared-packages/spec.md) — workspace package boundaries (`@trails-cool/types`, `@trails-cool/map`, `@trails-cool/fit`, etc.).

## Conventions

- Spec filenames use kebab-case capability names (`profile-settings`, `social-follows`, `sse-broker`).
- Cross-spec references should link to the other spec's path rather than duplicate requirements (see `public-profiles` linking to `social-follows` for the followers/following list access rule, and `account-management` linking to `journal-auth` for the Terms gate).
- New behavior lands through `openspec/changes/<name>/` with a delta in `specs/<capability>/spec.md`. The delta is promoted to the top-level spec when the change is archived (via `/opsx:archive`).
- Drift catch-up — i.e. updating a spec to match shipped code without changing behavior — can be edited directly without a change, since there's no behavioral payload to propose. Always update `CAPABILITIES.md` in the same edit if a spec is added, removed, or renamed.
