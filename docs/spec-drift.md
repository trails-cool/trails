# Spec ↔ Implementation Drift Report

This document lists all known drifts between the OpenSpec specifications in `openspec/specs/` and the actual implementation.

> **Last updated**: 2026-04-03

---

## Active Drifts

### 1. No-go areas are converted to circles for BRouter, not passed as polygons

- **Spec**: `openspec/specs/brouter-integration/spec.md` — "BRouter request includes nogo parameters for each polygon"
- **Implementation**: `apps/planner/app/lib/brouter.ts` (`noGoAreasToParam()`) converts each polygon to a circle by computing the centroid and using the maximum distance from centroid to any vertex as the radius. BRouter receives `lon,lat,radius` parameters, not polygon coordinates.
- **Impact**: Routing avoidance is approximate. Elongated or concave polygons may not be accurately represented as circles, allowing routes to pass through parts of the drawn area.
- **Resolution options**: Update the spec to document the circle approximation (BRouter only supports circle-based no-go areas), or implement polygon decomposition into multiple overlapping circles for better coverage.

---

## Resolved Drifts

Previously identified drifts that have been fixed via code changes or spec updates.

| # | Drift | Fixed in | Resolution |
|---|-------|----------|------------|
| 2 | PostGIS `geom` column never populated | PR #150, #151 | `setGeomFromGpx()` now populates geometry via `ST_GeomFromGeoJSON` on route/activity creation |
| 3 | Planner metrics gauges always zero | PR #149 | Gauges wired to `.inc()`/`.dec()` in `yjs-server.ts` on client connect/disconnect |
| 4 | Email provider spec said Resend, impl uses SMTP | PR #153 | Spec updated to document Nodemailer + SMTP |
| 5 | Server type spec said CX21, Terraform has cx23 | PR #153 | Spec updated to document cx23 |
| 6 | Secret files split into two instead of one | PR #153 | Spec updated to document `secrets.app.env` + `secrets.infra.env` split |
| 7 | BRouter host failover spec said "within 5 seconds" | PR #153 | Spec updated to document immediate deterministic election |
| 8 | Health endpoint extra `version` field | PR #153 | Spec updated to include `version` in response format |
| 9 | Extra `brouter_request_duration_seconds` metric | PR #153 | Spec updated to document the metric |
| 10 | 5 routing profiles vs 2 in spec | PR #153 | Spec updated to list all 5 profiles |
| 11 | Session 30-day max age ceiling not enforced | PR #153 | Spec updated to document no hard ceiling |
| 12 | Interactive map features in planner app, not shared package | PR #153 | Spec updated to document architecture decision |
