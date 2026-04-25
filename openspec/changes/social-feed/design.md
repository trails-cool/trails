## Context

trails.cool has the primitives for a social layer in place but nothing wired up:

- Users have public profiles at `/users/:username` (post `public-content-visibility`).
- Activities and routes have `public | unlisted | private` visibility.
- There is no `follows` relation today, no follower/following lists, and no aggregated feed.
- **No ActivityPub yet.** The Journal does not currently speak ActivityPub. There are no actor objects, no inbox, no outbox, no HTTP-signing layer, no Fedify dependency. Federation is genuinely Phase 2 (per `CLAUDE.md`) and is being scoped separately as the `social-federation` change.

This change is local-only social: follows between users on the same Journal instance, and the `/feed` aggregation. The schema is shaped so federation can layer on without a migration when it arrives.

## Goals / Non-Goals

**Goals:**
- A logged-in user can follow another local user with a public profile and see their public activities in a `/feed` view.
- Profile visibility is explicit (`users.profile_visibility`), gates followability deterministically, and pre-pays the model for federation and locked accounts.
- Follower and following counts + lists are public per local instance.
- Unfollow fully cleans up.
- Schema is forward-compatible: `follows` keyed by `actor_iri TEXT` so when remote follows land in `social-federation`, they slot in with no migration.

**Non-Goals:**
- **All ActivityPub federation primitives** — Fedify integration, actor objects, WebFinger, signed inbox/outbox, remote actor caching, audience-aware ingestion. Deferred to `social-federation`. The `follows` schema is shaped to accept remote IRIs but no remote IRIs will land in this change.
- **Locked local accounts** (a manual approval flow for our own users). Out of scope; the `'public' | 'private'` enum on `profile_visibility` is intentionally minimal so a `locked` value or `users.locked` flag can extend it cleanly. Tracked as follow-up `locked-local-accounts`.
- Blocking, muting, or report flows.
- Direct messages or any non-activity ActivityPub object.
- Real-time WebSocket feed updates. The feed is loader-driven and refreshes on page load.
- A "people you may know" / suggestions surface.

## Decisions

### Decision: Make profile visibility explicit on the `users` row

Today the Journal has no profile-level visibility setting. A profile is "public" implicitly: `/users/:username` returns 200 iff the user has at least one `public` route or activity, otherwise 404 (and the 404 doesn't distinguish "no such user" from "private content only" so existence isn't leaked).

Add `users.profile_visibility: 'public' | 'private'` (NOT NULL, default `'public'`).

The new rules:

- `/users/:username` returns 200 iff `profile_visibility = 'public'`. A public profile with zero `public` items renders an empty shell (header + empty-state copy in the routes/activities sections), matching Mastodon-style "discoverable account, no posts yet" behavior. The explicit `profile_visibility` toggle is the contract for hiding the profile; existence of a public-but-empty account is observable, and that's accepted.
- A user is followable iff `profile_visibility = 'public'`, regardless of whether they have content yet. Following someone before they post is reasonable; the follower's feed just stays empty for that follow until the user posts.

When `social-federation` lands, the local user's ActivityPub actor object will gate on the same `profile_visibility = 'public'` check — private profiles will return 404 to federation lookups too.

**Default `'public'`:** matches fediverse convention (Mastodon defaults to discoverable; "lock" is opt-in), aligns with the existing implicit behavior where any user *could* be public, and keeps onboarding smooth (post a public route → it's listed on your profile, no extra toggle). Activity-level privacy still defaults to `'private'`, so content stays private by default; *being findable on the network* is the part we default open.

**Migration:** backfill all existing users to `'public'`. Operators can flip themselves to `'private'` post-migration if desired.

**Why explicit, why now:** with follows landing, the question "can someone follow you?" needs a deterministic answer. Deriving it from "do you have any public content?" is fragile (toggling content visibility silently flips followability). The toggle also pre-pays for `locked-local-accounts`, which will extend this enum or add a `users.locked` flag.

**Alternative considered:** add a `'public' | 'unlisted' | 'private'` triple to mirror activity visibility. Rejected for now — `'unlisted'` for profiles ("actor object resolvable but profile page 404s") is a real fediverse pattern but a confusing UX surface to ship before users ask for it. Add as a third state if needed later.

### Decision: Pull-based feed, not fan-out-on-write

The feed query is:
```sql
SELECT a.* FROM journal.activities a
  JOIN journal.follows f ON f.followed_user_id = a.owner_id
  WHERE f.follower_id = :currentUser
    AND f.accepted_at IS NOT NULL
    AND a.visibility = 'public'
  ORDER BY a.created_at DESC LIMIT 50;
```

We pull at read time rather than precomputing per-follower timelines at write time.

**Why:** our scale is tiny (hundreds of users, not millions), and pull keeps us free of the consistency+cleanup headaches that fan-out-on-write brings (deletes, visibility changes, unfollows, backfill on new follow). A `(follower_id, created_at DESC)` index on `follows` + the existing `(created_at)` index on `activities` makes the join O(k log n) for k follows, which is fine to well past the scale trails.cool cares about for years. The same query naturally extends to remote activities once `social-federation` adds the remote-content cache.

**Alternative considered:** write-side fan-out into a per-user timeline table. Rejected for the complexity vs. the scale we'll actually hit.

### Decision: Store follows keyed by actor IRI even though all rows are local today

Schema:
```
follows(
  id UUID PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES users(id),  -- always a local user
  followed_actor_iri TEXT NOT NULL,                -- e.g. https://trails.cool/users/bruno; future: remote IRIs
  followed_user_id TEXT REFERENCES users(id),      -- non-null for local follows; FK for fast joins
  accepted_at TIMESTAMPTZ,                         -- always set in this change (auto-accept for local public)
  created_at TIMESTAMPTZ DEFAULT now()
)
UNIQUE (follower_id, followed_actor_iri)
INDEX   (follower_id, created_at DESC)
INDEX   (followed_actor_iri)
```

The follower is always a local user. The followed side is an actor IRI. In this change all IRIs are local (built as `https://{DOMAIN}/users/{username}`). `followed_user_id` is always populated, so queries that need the full user row do an indexed FK join.

**Why keyed by IRI now:** ActivityPub is IRI-first, and the `social-federation` change will need this column to point at remote actors. Adding it now (instead of just a `followed_user_id` FK) costs one extra column and a tiny IRI-builder helper today, and saves a real schema migration + backfill when federation lands. The denorm `followed_user_id` keeps query performance identical to a pure-FK design for local-only operation.

**Why `accepted_at` even though it's always set in this change:** the column models the eventual lifecycle (Pending → Accepted → Rejected/Undone) that arrives with federation. Marking the column nullable now means no migration later when remote follows can sit in Pending.

### Decision: Feed lives at `/feed` (new route), not on `/`

The signed-in home already is the personal dashboard. Overloading it with tabs now adds product complexity without much payoff. A dedicated `/feed` is discoverable via the nav and mirrors how Mastodon separates home and local timelines.

**Alternative:** tabs on `/` (Personal / Following / Public). Rejected for this change to keep scope small; easy to move later.

## Risks / Trade-offs

- **Privacy of follow lists**: follower/following lists are public on the instance. → Explicit, documented in the privacy manifest; matches Mastodon norms; users who don't want to be discoverable as a follower should set `profile_visibility = 'private'`, which 404s their profile and (when federation arrives) their actor object.
- **Empty feed on small instances**: a typical local-only instance will have few people to follow. → Acknowledged; the empty-state copy points users to `/users/:username` profiles to find folks. Federation will widen the pool, but isn't part of this change.
- **Schema churn at federation time**: even with the forward-compatible IRI column, `social-federation` will likely add `remote_actors` + audience columns + per-user keypair storage. → Accepted; the federation change can iterate on its own schema. The local-only follows + feed survive untouched.
- **Feed query growth**: at 50k activities × 1k follows, the join could degrade. → The `(follower_id, created_at DESC)` index keeps this fine up to ~10k follows per user; above that we'd revisit fan-out-on-write. Punt.
- **Marketing copy currently overstates federation**: the Journal home blurb says "Federated by design — your Journal instance talks to other trails.cool servers via ActivityPub. Follow friends anywhere." → Out of scope for this PR; soften copy as a separate one-liner change before public launch, or leave as forward-looking until `social-federation` lands.

## Migration Plan

1. Land schema via `drizzle-kit push --force` — adds `follows` table and `users.profile_visibility` column. No row backfill needed (column default fills existing users with `'public'`).
2. Ship API + UI behind no flag — the feature is additive and a user with zero follows just sees an empty `/feed`.
3. Document the new relation + setting in the privacy manifest before user-visible release.
4. Rollback: revert the PR. The `follows` table can be dropped without affecting other data; the `profile_visibility` column can be dropped, returning the implicit "public iff has public content" behavior (loaders already check that).

## Open Questions

- Should the initial nav entry be labeled "Feed" or "Following"? "Feed" is shorter and matches the route; "Following" is clearer about what's in it. Tasks phase can pick — lean "Feed" for now.
- Do we surface the instance's local public feed anywhere for signed-in users post-change? Today they see it only when signed out. A "Local" tab alongside the Following feed could be a later follow-up; not in this change.
