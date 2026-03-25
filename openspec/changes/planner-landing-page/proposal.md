## Why

The Planner at planner.trails.cool should work as a standalone product — anyone
can visit, understand what it does, and start planning a route without needing
the Journal. Currently the home page is a blank heading with no explanation and
no way to start. Visitors bounce immediately.

## What Changes

- Replace the Planner home page with a landing page that explains the tool:
  collaborative route planning, BRouter routing, GPX export, no account needed
- Prominent "Start Planning" CTA that creates a new session
- Brief feature highlights (collaborative editing, routing profiles, elevation,
  GPX export)
- Footer with links to trails.cool Journal, privacy page, GitHub repo
- The landing page should load fast — no heavy assets, SSR-friendly

## Capabilities

### New Capabilities

(None — this replaces an existing page with useful content.)

### Modified Capabilities

- `planner-session`: Home page becomes a landing page with session creation CTA
- `map-display`: Landing page may show a decorative map or screenshot

## Impact

- **Files**: `apps/planner/app/routes/home.tsx` (complete rewrite), i18n keys
- **Dependencies**: None
- **Design**: Needs to look good — this is the first impression for standalone
  Planner users
