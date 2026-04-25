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
- Blocking, muting, or report flows.
- Direct messages or any non-activity ActivityPub object.
- Real-time WebSocket feed updates. The feed is loader-driven and refreshes on page load.
- A "people you may know" / suggestions surface.
- A unified notification center. The follow-request count badge in the navbar covers this one signal; broader notifications (for new public activities from people you follow, replies, etc.) will be designed in a follow-up.

## Decisions

### Decision: Locked-account model — `private` means stub-with-request, not 404

`users.profile_visibility: 'public' | 'private'` (NOT NULL). New users default to **`'private'`**; existing users were backfilled to **`'public'`** on first migration so behavior didn't change for anyone already on the instance.

Behavior:

- **Public profile**: `/users/:username` renders fully to anyone. Follows auto-accept.
- **Private (locked) profile**: `/users/:username` renders a stub for non-owner viewers without an accepted follow — header (display name, handle, follower/following counts) plus a 🔒 badge plus a "this profile is private" body and a Request-to-Follow button. Accepted followers (from earlier approval) see the full profile; the owner always sees their own profile. Follows against a private profile create a Pending row (`accepted_at = NULL`) which the owner approves or rejects from `/follows/requests`.
- **Approve/reject**: dedicated endpoints + a navbar entry with a count badge. Approving sets `accepted_at = now()`; rejecting deletes the row so the requester can re-request later.

This is the Mastodon "locked account" pattern, applied locally. It composes with federation cleanly: when `social-federation` lands, remote inbound `Follow` activities targeting a local private user will follow the same Pending → Accepted lifecycle.

**Default `'private'`:** matches trails.cool's privacy-first content defaults (activities and routes already default `'private'`). The earlier proposal defaulted public to mirror Mastodon, but Mastodon's default-public is for discoverable + auto-accept; ours is now stronger ("locked"), so opt-in is the right inversion.

**Existence is observable.** Even on a private profile the URL returns 200 with a stub. We accept that "the username exists" is leaked — `private` is about gating *content*, not gating *existence*. Hiding existence entirely is a different feature (and not one we ship; if you want to be undiscoverable, don't share your handle).

**Migration:** backfill existing users to `'public'` so accounts created before this change keep their open behavior; new accounts post-deploy default `'private'`. No backfill of follow state needed because the social layer didn't exist before.

**Why now (not deferred to a separate change):** the 404-for-private model that an earlier draft of this spec described would have required a follow-up that re-implements the entire profile loader to switch to a stub. Doing the locked model from the start avoids that churn.

**Alternative considered:** add a `'public' | 'unlisted' | 'private'` triple where `unlisted` means "profile page 404s but actor object exists for federation." Rejected for now; we don't need three states, and `unlisted` is a confusing UX surface to ship without user demand.

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
