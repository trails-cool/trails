## Why

trails.cool has public activities and public profiles, but no way for users to build a network. A signed-in user's home today shows only their own activities; the visitor-facing home shows every instance's public activity indiscriminately. There's no "activities from people I care about" view, which is table stakes for a social outdoor journal and the differentiator that gives users a reason to sign up over just using the Planner.

This change ships the *local* social layer: follows between users on the same Journal instance and a personal `/feed` aggregating their public activities. ActivityPub federation (cross-instance follows, inbox/outbox dispatch, Fedify integration) is deliberately deferred to a follow-up change `social-federation` so this lands in days rather than weeks. The schema is forward-compatible: when federation arrives, remote follows slot in without migration.

## What Changes

- Add an explicit `users.profile_visibility` setting (`'public' | 'private'`, default `'public'`). Today profile-publicness is implicit (derived from "has any public content"); making it explicit unifies the mental model with activity/route visibility, gives users a real toggle for "be discoverable at all," and gates future federation cleanly. Existing users migrate to `'public'`.
- Users SHALL be able to follow another *local* user (same instance) by clicking a Follow button on the user's profile page. Local public profiles auto-accept the follow.
- A signed-in user SHALL be able to view a **social feed** of public activities from the users they follow, reverse-chronological, at a dedicated `/feed` route linked from the nav.
- The logged-in home (`/`) SHALL link prominently to the new social feed; personal dashboard content stays as-is for now.
- Public profile pages SHALL show follower and following counts and a Follow / Unfollow toggle for the viewing user.
- Privacy: the follow relationship on a single instance is queryable (follower/following lists are public) matching Mastodon-style conventions. Only `public` activities appear in the feed — `unlisted` and `private` stay out even if you follow the owner.
- Privacy manifest: documents the new `follows` relation as data the instance retains about who follows whom.
- **Forward-compatible schema**: `follows` is keyed by an `actor_iri TEXT` column even though all rows are local now (local user IRIs look like `https://{DOMAIN}/users/{username}`). When `social-federation` lands, remote IRIs go in the same column with no migration.
- **Out of scope** (tracked as follow-ups):
  - ActivityPub federation primitives — `social-federation`. Goal there is "Mastodon can follow a trails account" inbound and "trails can follow other trails instances" outbound.
  - Locked local accounts (manual follow approval) — `locked-local-accounts`. The current `'public' | 'private'` enum is intentionally minimal so the locked enum value (or a separate `users.locked` flag) can be added cleanly later.

## Capabilities

### New Capabilities

- `social-follows`: the follow/unfollow graph (local now, federated later) and the aggregated social activity feed surfaced at `/feed`.

### Modified Capabilities

- `public-profiles`: add a `profile_visibility` setting on users, gate `/users/:username` on it, and add Follow / Unfollow button + follower and following counts to the profile page.
- `journal-landing`: add a prominent link from the signed-in home to the new `/feed` route; personal dashboard content stays.

## Impact

- **Code**: new `follows` table (Drizzle + migration), new `users.profile_visibility` column. Queries for follower/following lists, aggregated feed query, new routes (`/feed`, `/users/:username/followers`, `/users/:username/following`), profile-visibility setting in account settings.
- **API**: new endpoints `POST /api/users/:username/follow`, `POST /api/users/:username/unfollow`; existing public-profile and feed endpoints gain follower/following counts.
- **UI**: Follow button + counts on `/users/:username`; new `/feed` route with card list (reuses the home-feed card component); nav item "Feed" visible to signed-in users; profile-visibility toggle in `/settings/profile`.
- **Federation**: deferred to `social-federation`. The schema's IRI key + `users.profile_visibility` are placed now so the federation change is additive (no schema rewrite).
- **Dependencies**: none new; `drizzle-kit push` handles the schema migration.
- **Privacy manifest**: new entry documenting the `follows` relation (which user follows whom on this instance, when).
- **Operational**: the social feed query joins follows with activities; the existing index on `activities(created_at)` plus a new `(follower_id, created_at DESC)` on `follows` keeps the join cheap to thousands of follows per user.
