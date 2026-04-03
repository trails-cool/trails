# Spec ↔ Implementation Drift Report

This document lists all known drifts between the OpenSpec specifications in `openspec/specs/` and the actual implementation.

> **Last updated**: 2026-04-03

---

## Active Drifts

None — all identified drifts have been resolved.

---

## Resolved Drifts

Previously identified drifts that have been fixed via code changes or spec updates.

| # | Drift | Fixed in | Resolution |
|---|-------|----------|------------|
| 1 | PostGIS `geom` column never populated | PR #150, #151 | `setGeomFromGpx()` now populates geometry via `ST_GeomFromGeoJSON` on route/activity creation |
| 2 | Planner metrics gauges always zero | PR #149 | Gauges wired to `.inc()`/`.dec()` in `yjs-server.ts` on client connect/disconnect |
| 3 | Email provider spec said Resend, impl uses SMTP | PR #153 | Spec updated to document Nodemailer + SMTP |
| 4 | No-go areas converted to circles instead of polygons | PR #155 | `noGoAreasToParam()` now passes polygon vertices directly via BRouter's `polygons` parameter |
| 5 | Server type spec said CX21, Terraform has cx23 | PR #153 | Spec updated to document cx23 |
| 6 | Secret files split into two instead of one | PR #153 | Spec updated to document `secrets.app.env` + `secrets.infra.env` split |
| 7 | BRouter host failover spec said "within 5 seconds" | PR #153 | Spec updated to document immediate deterministic election |
| 8 | Health endpoint extra `version` field | PR #153 | Spec updated to include `version` in response format |
| 9 | Extra `brouter_request_duration_seconds` metric | PR #153 | Spec updated to document the metric |
| 10 | 5 routing profiles vs 2 in spec | PR #153 | Spec updated to list all 5 profiles |
| 11 | Session 30-day max age ceiling not enforced | PR #153 | Spec updated to document no hard ceiling |
| 12 | Interactive map features in planner app, not shared package | PR #153 | Spec updated to document architecture decision |
