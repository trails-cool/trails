## Why

A user who wants to follow someone on this instance has no in-app path to discover them — they need a username from outside the app, type it into `/users/<username>` directly, or stumble onto a profile via the public activity feed on logged-out `/`. With four prod users today this is just a friction; with federation in Phase 2 it becomes a real gap. Add `/explore` as the in-app discovery surface so finding people to follow is a first-class action, not a workaround.

## What Changes

- Add a new `/explore` route to the Journal app, reachable to both signed-in users and anonymous visitors.
- Render a paginated directory of local users with `profile_visibility = 'public'`, ordered by most-recent activity (`MAX(activities.created_at)` per user, descending; users with no activities sort to the end by `users.created_at`).
- Within the directory page, surface a small "Active recently" section at the top — the top N (5 by default) public users who posted a public activity in the last 30 days. Same data set, just sliced and surfaced.
- Exclude private (locked) profiles, banned/suspended users (when those statuses exist), and the demo persona from the directory — they have explicit opt-outs from public discovery.
- Each directory row shows: display name, handle (`@username`), short bio (truncated), follower count (accepted only), and a Follow / Requested / Unfollow button (locked-account semantics from `social-follows` apply, so a public-target row shows Follow, etc.). The button only renders for signed-in viewers.
- Add an "Explore" entry to the navbar for signed-in users (visible alongside Feed / Routes / Activities). Anonymous visitors reach `/explore` via a link on the visitor home page, not via the navbar.
- No search in v1. With four prod users a paginated list is enough; search is deferred — typing `/users/<username>` already partially solves it for known handles.

## Capabilities

### New Capabilities

- `explore`: discovery directory of local users for follow recommendations. Owns the `/explore` route, the directory query rules, the "Active recently" sub-list, the access model (anonymous + signed-in), and the navbar entry.

### Modified Capabilities

- `social-follows`: the directory needs a count of accepted followers per public user, which is already available via `countFollowers`. No new requirement; cross-reference only.
- `journal-landing`: the navbar entries grow by one ("Explore" for signed-in users). The visitor home gains a link to `/explore` so anonymous visitors have an in-app path to the directory.

## Impact

- **New code:** `apps/journal/app/routes/explore.tsx`, `apps/journal/app/lib/explore.server.ts` (the directory query and "Active recently" slice), navbar entry in `apps/journal/app/root.tsx`, link from the visitor home in `apps/journal/app/routes/home.tsx`, i18n keys in `packages/i18n/src/locales/{en,de}.ts`.
- **Modified code:** none — the existing helpers (`countFollowers`, `getFollowState`) cover the per-row data; the new query is additive in `explore.server.ts`.
- **No DB migrations:** the directory query is a JOIN of existing tables (`users`, `activities`); no new columns or tables.
- **No new dependencies.**
- **Privacy:** the directory is public-by-default and respects the profile-visibility opt-out. No private profile leaks.
- **Federation:** out of scope for v1. Remote-actor discovery is `social-federation`'s problem when that lands.
- **OpenSpec index:** `openspec/CAPABILITIES.md` gains an entry under the "Social" section.
