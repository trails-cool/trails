## Context

The Planner home page is currently a centered heading ("trails.cool Planner")
and subtitle. It has no CTA, no explanation, and no way to start. Users must
know to visit `/new` to create a session.

## Goals / Non-Goals

**Goals:**
- Explain what the Planner does in 5 seconds of reading
- One-click session creation (no signup, no form)
- Feature highlights: collaborative, BRouter routing, elevation, GPX export
- Link to Journal for users who want accounts and saved routes
- i18n (English + German)
- Fast load, SSR-friendly, no heavy JS

**Non-Goals:**
- Marketing copy or elaborate graphics
- Pricing or plans
- User testimonials
- Interactive map demo on the landing page (too heavy)

## Decisions

### D1: Single-page component in home.tsx

No new route — rewrite `apps/planner/app/routes/home.tsx`. The page is static
content + a CTA link to `/new`. No loader needed.

### D2: Feature cards with icons

Show 4-5 feature highlights as simple cards: collaborative editing, route
profiles, elevation profile, GPX export, no account needed. Use Tailwind —
no icon library, just emoji or simple SVG.

### D3: Link to Journal as secondary CTA

"Want to save your routes? Create a free account on trails.cool" — links to
the Journal. This bridges the two apps without requiring Journal for basic use.

### D4: Footer with legal and links

Privacy link (points to Journal's /privacy), GitHub repo, "Built with
BRouter and OpenStreetMap" attribution.
