## Why

Both apps have pages that are only reachable by typing URLs. The Journal has no
navigation bar — logged-in users can't find their routes or activities without
knowing the URLs. The Planner home page is a dead end with no way to create a
session. This makes the apps unusable for anyone who doesn't know the URL
structure.

## What Changes

- **Journal**: Add a navigation bar (home, routes, activities, profile, logout)
  that appears when logged in. Unauthenticated users see login/register links.
- **Planner**: Add a "New Session" CTA on the home page. Add a minimal header
  in session view with a link back to home.
- Both apps get consistent, minimal navigation that makes all features
  discoverable.

## Capabilities

### New Capabilities

(None — this adds UI chrome to existing features, no new behavioral capabilities.)

### Modified Capabilities

- `map-display`: Planner home page gains a CTA and session header gains a home link

## Impact

- **Files**: Journal `root.tsx` (nav bar), Planner `home.tsx` (CTA),
  Planner `SessionView.tsx` (home link), new `NavBar` component
- **Dependencies**: None
- **i18n**: New translation keys for navigation labels
