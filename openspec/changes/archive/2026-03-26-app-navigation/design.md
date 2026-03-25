## Context

Navigation audit found: Journal's `/routes` and `/activities` pages are
orphaned (no links point to them). The Planner home page has no CTA. Logout
is only on the profile page. Users must know URLs to use the apps.

## Goals / Non-Goals

**Goals:**
- Every non-API route reachable via UI navigation
- Logged-in Journal users see: Routes, Activities, profile, logout
- Logged-out Journal users see: login, register
- Planner home has a clear "start planning" action
- Keep it minimal — a thin bar, not a complex sidebar

**Non-Goals:**
- Mobile hamburger menu (responsive PR already hides sidebar — nav bar wraps naturally)
- Breadcrumbs or nested navigation
- Settings page (future)

## Decisions

### D1: Journal nav bar in root Layout

Add a `<nav>` element inside `Layout` in `root.tsx`. The root loader already
returns the user (added for Sentry context), so the nav bar can conditionally
show authenticated vs. unauthenticated links. No new loader needed.

### D2: Planner gets a CTA on home, not a nav bar

The Planner is session-focused — users arrive, create a session, and work in
it. A full nav bar would be overhead. Instead: home page gets a prominent
"Start Planning" button linking to `/new`. Session view already has a header —
add a small logo/home link to it.

### D3: Use @trails-cool/ui for shared nav component

The nav bar itself is Journal-specific (routes, activities, auth). No need
to put it in the shared UI package — it goes directly in Journal's root.tsx
or a colocated component.
