## Context

Static informational pages already follow a pattern: journal routes (`legal.terms.tsx`, `legal.privacy.tsx`, `privacy.tsx`) registered in `routes.ts`, linked from the shared `Footer.tsx`; the planner's footer links to absolute Journal URLs because the planner is stateless (spec `legal-disclaimers`, "Footer legal links"). The acknowledgment list lives in `docs/philosophy.md` (Open Source section, updated 2026-07-06 with Organic Maps and Endurain). Map attribution renders in the Leaflet attribution control; data-level attribution (GeoNames CC-BY from `activity-locations`, extended OSM usage from `poi-index`) has no page-level home yet — both changes reference "journal credits" as a pending surface.

## Goals / Non-Goals

**Goals:**
- One user-visible page that carries inspirations, data attributions, and key components — reachable from both apps' footers.
- Curated and short: every entry says *why* it's there in one line.
- Stays consistent with `docs/philosophy.md` without a build-time sync mechanism.

**Non-Goals:**
- Generated dependency/license inventory, sponsor/donor lists, per-page dynamic attribution logic (the Leaflet control keeps doing on-map attribution).

## Decisions

### 1. Route: `/about/credits` on the Journal, static component

A plain route module like the legal pages — no loader, content as JSX with `useTranslation`. Chosen over `/legal/credits` because credits aren't a legal disclosure and shouldn't imply one; `/about/` leaves room for future informational pages. Planner links to `${JOURNAL_URL}/about/credits`, mirroring the legal-links pattern exactly.

### 2. Content structure: three typed lists, strings in i18n

The entries (name, URL, description-key) live as a small typed array in the route module; descriptions and headings resolve through i18n so de/en stay complete. Entry list: Inspirations (BRouter, bikerouter.de, brouter-web, Organic Maps, Endurain, wanderer), Data (OSM/ODbL with the required "© OpenStreetMap contributors" wording, BRouter segment data, tile providers, GeoNames slot commented until `activity-locations` lands), Built with (BRouter, Leaflet, Yjs, Fedify, PostGIS).

*Alternative:* markdown file rendered at build time — rejected; i18n for prose is already the established mechanism and a JSX page matches the legal-page precedent.

### 3. Sync with the docs by convention, not tooling

`docs/inspirations.md` is the canonical record: each project entry carries a **credit line** that is the exact acknowledgment text for both the philosophy list and this page's entries (translated for de). A comment atop the entries array points there; a generator would be over-engineering for a six-item list (simplicity principle).

## Risks / Trade-offs

- [Lists drift between docs and page] → cross-reference comments; both files touched in the same PR whenever an inspiration is added (as this change itself demonstrates).
- [Attribution wording obligations (ODbL, CC-BY)] → use each project's canonical attribution string; verify against their attribution guidelines in tasks.

## Migration Plan

Additive UI + route registration; no data or API changes. Rollback = revert.

## Open Questions

- None blocking.
