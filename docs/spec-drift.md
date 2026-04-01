# Spec ↔ Implementation Drift Report

This document lists all known drifts between the OpenSpec specifications in `openspec/specs/` and the actual implementation. Each drift is categorized by severity.

> **Generated**: 2026-04-01

---

## Critical Drifts

These drifts represent missing or fundamentally different functionality.

### 1. PostGIS geometry column is never populated

- **Spec**: `openspec/specs/route-management/spec.md`
- **Requirement**: "Route geometries SHALL be stored as PostGIS LineString geometries extracted from the GPX"
- **Implementation**: The `geom` column exists in the `journal.routes` and `journal.activities` database schema (`packages/db/src/schema/journal.ts`), but no code ever populates it. Route creation in `apps/journal/app/lib/routes.server.ts` and activity creation in `apps/journal/app/lib/activities.server.ts` insert rows without setting the `geom` field. GPX coordinates are parsed for stats but never converted to a PostGIS LineString.
- **Impact**: Spatial queries (e.g. route discovery via bounding box) are impossible. The `route-discovery` change depends on this working.

### 2. Planner metrics gauges are defined but never updated

- **Spec**: `openspec/specs/observability/spec.md`
- **Requirement**: Planner exposes `planner_active_sessions` and `planner_connected_clients` Prometheus gauges reflecting live counts.
- **Implementation**: Both gauges are registered in `apps/planner/app/lib/metrics.server.ts`, and helper functions `getDocCount()` and `getClientCount()` exist in `apps/planner/app/lib/yjs-server.ts`, but nothing ever calls `.set()`, `.inc()`, or `.dec()` on these gauges. They always report `0`.
- **Impact**: Grafana dashboards and alerts relying on session/client counts show no data.

---

## Moderate Drifts

These drifts represent implementation choices that differ from spec but the feature still works.

### 3. Email provider is SMTP/Nodemailer, not Resend

- **Spec**: `openspec/specs/transactional-emails/spec.md`
- **Requirement**: "Production via Resend provider"
- **Implementation**: `apps/journal/app/lib/email.server.ts` uses `nodemailer` with a generic `SMTP_URL` connection string. There is no Resend SDK integration. The `SMTP_FROM` env var controls the sender address.
- **Impact**: Functional — emails are sent correctly. The provider is different from what the spec documents, which could cause confusion during onboarding or incident response.

### 4. No-go areas are converted to circles for BRouter, not passed as polygons

- **Spec**: `openspec/specs/no-go-areas/spec.md`
- **Requirement**: "BRouter request includes nogo parameters for each polygon"
- **Implementation**: `apps/planner/app/lib/brouter.ts` (`noGoAreasToParam()`) converts each polygon to a circle by computing the centroid and using the maximum distance from centroid to any vertex as the radius. BRouter receives `lon,lat,radius` parameters, not polygon coordinates.
- **Impact**: Routing avoidance is approximate. Elongated or concave polygons may not be accurately represented as circles, allowing routes to pass through parts of the drawn area.

### 5. Infrastructure server type is cx23, not CX21

- **Spec**: `openspec/specs/infrastructure/spec.md`
- **Requirement**: "CX21 server (2 vCPU, 4 GB RAM, 40 GB SSD)"
- **Implementation**: `infrastructure/terraform/main.tf` specifies `server_type = "cx23"`, which is a larger instance.
- **Impact**: Higher cost than spec anticipates. The application works correctly — the server is simply more powerful than specified.

### 6. Secret management uses two files instead of one

- **Spec**: `openspec/specs/secret-management/spec.md`
- **Requirement**: Single SOPS-encrypted file `infrastructure/secrets.env`
- **Implementation**: Two SOPS-encrypted files exist: `infrastructure/secrets.app.env` (application secrets) and `infrastructure/secrets.infra.env` (infrastructure secrets). The `.sops.yaml` creation rule matches `secrets\..*\.env$`.
- **Impact**: The split is a reasonable evolution for separation of concerns. CD workflows decrypt and merge both files at deploy time. The spec should be updated to reflect this.

### 7. BRouter host failover is immediate, not "within 5 seconds"

- **Spec**: `openspec/specs/brouter-integration/spec.md`
- **Requirement**: "Host failover on disconnect (within 5 seconds)"
- **Implementation**: `apps/planner/app/lib/host-election.ts` uses deterministic client-ID-based election. When the host disconnects, the Yjs awareness change event fires immediately and the client with the lowest remaining ID becomes host. There is no 5-second delay or timeout mechanism.
- **Impact**: The implementation is actually better than the spec — failover is instant rather than delayed. The spec's "within 5 seconds" was likely a maximum latency target, not a deliberate delay.

---

## Minor Drifts

These drifts are small deviations that don't affect functionality.

### 8. Health endpoint includes extra `version` field

- **Spec**: `openspec/specs/observability/spec.md`
- **Requirement**: Health response is `{ "status": "ok"|"degraded", "db": "connected"|"unreachable" }`
- **Implementation**: Both `apps/journal/app/routes/api.health.ts` and the Planner's `server.ts` include an additional `version` field (`process.env.SENTRY_RELEASE ?? "dev"`) in the response.
- **Impact**: Additive — does not break spec consumers. Useful for debugging which version is deployed.

### 9. BRouter request duration metric is not in spec

- **Spec**: `openspec/specs/observability/spec.md`
- **Requirement**: Lists `http_request_duration_seconds`, `planner_active_sessions`, and `planner_connected_clients` as custom metrics.
- **Implementation**: The Planner also registers `brouter_request_duration_seconds` histogram in `apps/planner/app/lib/metrics.server.ts`, which is not mentioned in the spec.
- **Impact**: Additive — extra observability. Spec should be updated to document this metric.

### 10. Routing profiles are broader than spec examples

- **Spec**: `openspec/specs/brouter-integration/spec.md`
- **Requirement**: Spec scenarios mention `trekking` and `shortest` profiles.
- **Implementation**: `apps/planner/app/components/ProfileSelector.tsx` offers 5 profiles: `trekking`, `fastbike`, `safety`, `shortest`, `car`.
- **Impact**: Additive — more profiles available than spec examples suggest. The spec is under-specified rather than contradicted.

### 11. Planner session max age ceiling is not enforced

- **Spec**: `openspec/specs/planner-session/spec.md`
- **Requirement**: "Session auto-expiry (7 days default, max 30 days)"
- **Implementation**: `apps/planner/app/lib/sessions.ts` has `expireSessions(maxAgeDays: number = 7)` with a configurable parameter, but there is no hard ceiling at 30 days. Callers could pass any value.
- **Impact**: In practice the default 7-day value is always used. The 30-day max is a spec constraint that isn't enforced in code.

---

## Spec Coverage Gaps

These are areas where the spec describes features implemented in a different location than expected.

### 12. Map package contains only core components; interactive features live in Planner app

- **Spec**: `openspec/specs/shared-packages/spec.md`
- **Requirement**: `@trails-cool/map` provides "React Leaflet components (MapView, RouteLayer)"
- **Implementation**: `packages/map/src/` contains `MapView` and `RouteLayer` as specified. However, interactive map features (ghost markers, route drag-reshape, cursor rendering, no-go area drawing, colored routes, elevation chart) are all implemented directly in `apps/planner/app/components/` rather than in the shared package.
- **Impact**: These features are Planner-specific and not reused by the Journal app, so placing them in the app is a reasonable architecture decision. The spec is not violated — it only requires MapView and RouteLayer in the shared package.
