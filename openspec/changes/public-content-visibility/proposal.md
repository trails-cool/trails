## Why

trails.cool currently has no way to show its content to anyone who isn't logged in. Route and activity detail pages require auth, there is no public-facing profile page, and shared URLs have no Open Graph metadata — so a link pasted in Slack or on a social platform looks like a blank trails.cool card.

Two immediate reasons to fix this:

1. **Demos + acquisition.** The next phase of the project is onboarding more users and contributors. The pitch lands better when you can send a URL that opens directly to "look at this route / this weekend's ride" without making the visitor register first.
2. **Prerequisite for any `demo-activity-bot` work.** A synthetic-activity generator is pointless if the generated content isn't publicly viewable. This change unblocks that follow-up.

This is also the smallest possible step into the "social" direction the Journal was always described as heading for. It does not introduce follow/follower, cross-user feeds, reactions, or ActivityPub — those remain future work.

## What Changes

- New `visibility` column on routes and activities with values `private` (default for existing rows), `unlisted` (reachable only by direct URL, excluded from listings), `public` (visible everywhere).
- Logged-out visitors can view **public** route and activity detail pages. Private / nonexistent routes return 404, just like logged-in requests to other users' private content. Unlisted renders for anyone with the URL but does not appear in listings.
- New public profile page at `/users/:username` that lists that user's **public** routes and activities. Returns 404 if the user has no public content (keeps the existence of private-only accounts itself private).
- Route detail page gains a visibility selector for owners (the existing edit page is the natural home).
- Open Graph / Twitter Card meta tags on public route and activity detail pages so shared URLs preview nicely (title, description, a small route preview image for future, the instance name as site).
- **BREAKING for spec-readers only**: several existing requirements in `route-management` and `activity-feed` are modified to reflect the new "auth-or-public" access rule. The default in migration is `private`, so **behaviour for existing users does not change** — their routes stay inaccessible to logged-out visitors until they explicitly make one public.

## Capabilities

### New Capabilities
- `public-profiles`: Public-facing user pages at `/users/:username` listing a user's public routes and activities, with nothing shown for users who have no public content.

### Modified Capabilities
- `route-management`: adds visibility field + modified access rules so public routes are viewable without auth; owners can change visibility.
- `activity-feed`: adds visibility field; public activities render to logged-out visitors.

## Impact

- **Code**: schema (`visibility` column on `routes` + `activities`), loader auth changes on `routes.$id.tsx` / `activities.$id.tsx`, new route `users.$username.tsx` (already exists but is auth-gated today), a visibility selector somewhere in the route edit flow, a `meta` export on public detail pages for OG tags.
- **Data**: default `visibility = private` for all existing rows — three users, zero activities, two empty routes — so migration is effectively a no-op for behaviour. No backfill needed.
- **Privacy**: this change explicitly reduces the default privacy posture *only if a user opts in by marking content public*. A short sentence in `/legal/privacy` notes public content is world-visible. No new third-party surface.
- **Search engines**: public pages are not actively promoted (no sitemap). `robots: noindex` stays on legal pages and settings; `routes` and `activities` public pages get a permissive default (search-indexable) so demo URLs work well.
- **Non-goals (explicit)**: follow/follower, a cross-user feed, reactions/comments, federation, route privacy per-section. Keeping scope tight.
- **Rollback**: flipping the default back to `private` everywhere is a single UPDATE. Pages gating on visibility degrade to "auth-only" if we remove the public path.
