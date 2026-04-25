## 1. Schema

- [ ] 1.1 Add `follows` table to `packages/db/src/schema/journal.ts`: `id UUID PK`, `follower_id TEXT NOT NULL REFERENCES users`, `followed_actor_iri TEXT NOT NULL` (forward-compatible with federation), `followed_user_id TEXT REFERENCES users` (always populated for local follows in this change), `accepted_at TIMESTAMPTZ` (always set to `now()` in this change but kept nullable for future Pending state), `created_at TIMESTAMPTZ DEFAULT now()`. Unique `(follower_id, followed_actor_iri)`. Indexes `(follower_id, created_at DESC)` and `(followed_actor_iri)`
- [ ] 1.2 Add `profile_visibility TEXT NOT NULL DEFAULT 'public'` (`'public' | 'private'`) to `journal.users`. Existing rows pick up the default (= public), preserving current effective behavior for everyone
- [ ] 1.3 Add a small helper `localActorIri(username)` returning `https://{DOMAIN}/users/{username}` to keep IRI construction consistent across the codebase
- [ ] 1.4 Run `pnpm db:push` locally and confirm migration is clean (no prompts, no ambiguity)
- [ ] 1.5 Update the privacy manifest to document the `follows` relation (which user follows whom on this instance, when) and the new `profile_visibility` setting

## 2. Follow / unfollow API

- [ ] 2.1 Add `follow.server.ts` with `followUser(followerId, targetUsername)` and `unfollowUser(followerId, targetUsername)` that resolve the local target, refuse if `profile_visibility = 'private'` or self-follow, write/delete the row, and return the new state
- [ ] 2.2 `POST /api/users/:username/follow` route: session-bound, calls `followUser`, returns 200 with new state or 4xx on refusal
- [ ] 2.3 `POST /api/users/:username/unfollow` route: session-bound, calls `unfollowUser`, returns 200 with new state
- [ ] 2.4 Unit tests: follow/unfollow happy path, refusal for private profile, self-follow rejected, idempotent follow/unfollow

## 3. Follower / following collections

- [ ] 3.1 Queries for follower list and following list of a given user, paginated (50/page), reverse-chron on `accepted_at`
- [ ] 3.2 Routes `/users/:username/followers` and `/users/:username/following` rendering paginated lists with display name + handle + small profile link
- [ ] 3.3 Query + UI for follower and following counts on `/users/:username`

## 4. Social feed

- [ ] 4.1 Query `listSocialFeed(followerId, limit, cursor)` joining `follows` → `activities`, returning rows where `accepted_at IS NOT NULL` AND `a.visibility = 'public'`, reverse-chronological by `created_at`
- [ ] 4.2 Route `/feed` (signed-in only; redirects to `/auth/login` when anonymous) rendering the aggregated cards; reuse the existing activity-card component from the home visitor feed
- [ ] 4.3 Empty state: "You're not following anyone yet" with a link to the instance public feed at `/`
- [ ] 4.4 Register the route in `apps/journal/app/routes.ts`
- [ ] 4.5 Add a "Feed" link to the signed-in nav + the personal dashboard header next to "New Activity"

## 5. Profile page + visibility

- [ ] 5.1 Follow / Unfollow button component — state pulled from the viewer's session + `follows` row, action submits to the new API route
- [ ] 5.2 Integrate on `/users/:username` above the public route/activity list; hide for the profile owner
- [ ] 5.3 Follower/following count display linking to the new collection pages
- [ ] 5.4 Update `/users/:username` loader to gate on `profile_visibility = 'public'` AND has-public-content (preserve indistinguishable 404)
- [ ] 5.5 Add a "Profile visibility" toggle (Public / Private) to `/settings/profile`, with a one-line explainer of what each mode does
- [ ] 5.6 Owner-only redirect or "your profile isn't public yet" view for owners whose profile would 404 to visitors

## 6. Testing

- [ ] 6.1 Unit tests for `listSocialFeed` query: only follows of `accepted_at IS NOT NULL`, only `public` activities, pagination boundary
- [ ] 6.2 E2E: register two local users, A follows B, B posts a public activity → A sees it on `/feed`; B posts a private activity → A does not
- [ ] 6.3 E2E: Follow button transitions (not following → Follow → Unfollow → not following), profile counts update
- [ ] 6.4 E2E: `/feed` redirects anonymous visitors to `/auth/login`
- [ ] 6.5 E2E: empty `/feed` renders the empty state and link to public feed
- [ ] 6.6 E2E (profile_visibility): owner flips to private → `/users/:username` returns 404 even with public content, the Follow button vanishes for any prospective follower. Owner flips back to public → previous behavior restored

## 7. Rollout

- [ ] 7.1 Schema ships via `drizzle-kit push --force` — additive only, no row backfill needed (column defaults handle existing users)
- [ ] 7.2 Post-deploy: smoke-follow bruno (demo-bot) from a test account, confirm bruno's public activity appears on `/feed`
- [ ] 7.3 (Follow-up change) `social-federation` adds Fedify, actor objects, signed inbox/outbox, remote follow + ingestion. The `follows` schema in this change supports those without migration
- [ ] 7.4 (Follow-up change) Consider a "Local" tab alongside the Following feed that surfaces the instance public feed for signed-in users — not in this change
