## Context

The Journal has no in-app discovery surface today. A signed-in user who wants to follow someone has to come in with a username from outside the app or notice a profile in the public activity feed on logged-out `/`. The four current prod users are all known to the operator, so this hasn't pinched yet — but the gap will become real as the user count grows, and worse once federation lands and remote actor discovery is also on the table.

The IA review (`docs/information-architecture.md`, Stream F) called this out as the highest-value missing surface. This design is the local-only v1: a paginated directory of public local users, ordered by recency of activity, plus a small "Active recently" sub-section to give the page some texture when the directory is small.

Existing infrastructure this builds on:

- `users` table has `profile_visibility` (`public` | `private`) — the directory's primary opt-out.
- `activities` table has `created_at` and `visibility` — used for ordering by recency and for the "Active recently" filter.
- `apps/journal/app/lib/follow.server.ts` already provides `countFollowers` and `getFollowState` per user — directly reusable for the per-row data.
- `apps/journal/app/components/FollowButton.tsx` already renders the right Follow / Requested / Unfollow state — directly reusable.
- The locked-account access rule (`social-follows`) already excludes private profiles from public listings; we follow the same pattern.

## Goals / Non-Goals

**Goals:**

- A signed-in user who lands on `/explore` can browse local public users and tap Follow / Request to follow without leaving the page.
- An anonymous visitor can browse the same directory (the data is public anyway), so first-visit discovery doesn't require sign-up.
- The page is paginated and sortable by a stable rule (recency of activity, descending) so it works at 4 users today and at 4,000 users later without a rewrite.
- Private profiles, banned/suspended users (when those statuses exist), and the demo persona are excluded.
- The capability lives in its own spec file; the directory query lives in its own server lib file. No bleed into `social-follows` or `activity-feed`.

**Non-Goals:**

- Search. Deferred to v2. With four prod users, a paginated list is enough; users with known handles can already reach `/users/<username>` directly.
- Algorithmic curation. No "people you might know" recommendations, no graph traversal, no engagement-based ranking. Recency-of-activity is the only signal.
- Remote actor discovery. Federation is `social-federation`'s problem when that lands; v1 is local-only.
- A dedicated user-detail card on `/explore`. Each row is a compact summary; deep dive is `/users/:username`.
- Activity content on `/explore`. The directory is *people*, not *posts*. The Public view of `/feed` (Stream A) is the content discovery surface.

## Decisions

### Anonymous access is allowed

`/explore` is reachable to logged-out visitors. Why:

- The data shown — public profiles only — is already reachable without auth (`/users/<username>` is anonymously reachable for public profiles), so there's no privacy concern.
- It's a stronger first-visit experience than the current logged-out home, which is hero + marketing + public *activity* feed. A visitor can see who's on the instance and decide to sign up to follow them.
- It mirrors how `/users/<username>` and the public activity feed treat anonymous visitors.

The Follow button on each row only renders for signed-in viewers; anonymous viewers see the row content but no action button.

**Alternative considered:** require auth, redirect anonymous to `/auth/login`. Rejected because it makes the discovery surface less valuable for the population it most needs to convert (first-time visitors).

### Directory is ordered by `MAX(activities.created_at)` descending

The most-recent-activity ordering keeps the directory feeling alive without algorithmic complexity. Users with no activities yet sort to the end (by `users.created_at` descending as a tiebreaker, so newer users appear ahead of older inactive ones).

**Alternatives considered:**

- **Alphabetical by username.** Predictable but boring; surfaces inactive accounts to the top half.
- **Random shuffle.** Fair to small users but not bookmarkable, breaks pagination.
- **Follower count.** Reasonable but has a Matthew-effect tilt; one or two heavy users would dominate page 1.

Recency-by-activity is the simplest signal that meaningfully reflects "who's active here right now."

### "Active recently" sub-section is the same query, sliced

The page renders an "Active recently" strip at the top (top 5 users with at least one public activity in the last 30 days). It's the same join as the main directory; the strip is just a different `WHERE` and `LIMIT`. We don't denormalize anything, don't precompute anything, don't cache anything. Below it is the full paginated directory.

**Why:** at 4 users this strip is the *whole* directory. At 4,000 users it's a useful signal-of-life. We can revisit when there's data to revisit on.

### Paginate via offset, not cursor (yet)

The directory uses standard `?page=N&perPage=20` offset pagination, capped at 100 per page. Why:

- The data is small (single-digit users today, low hundreds soon).
- Recency-of-activity is unstable enough as a sort key that cursor pagination would need to break ties on `users.id` anyway, and the win over offset is marginal at this scale.
- Offset pagination is the simplest thing that works.

When the directory hits ~10K users we'll revisit. Cursor pagination's the right answer there; not now.

**Alternative considered:** keyset cursor pagination like `/notifications`. Rejected as premature.

### Navbar entry for signed-in users only

Adding "Explore" to the navbar for signed-in users keeps the discovery surface visible from any page. For anonymous visitors, the navbar stays minimal (Login / Register CTAs) and `/explore` is reached via a link on the visitor home (`/`). The navbar redesign (Stream C) will work out the visual treatment; this proposal just specifies that the entry exists for signed-in users.

**Alternative considered:** put "Explore" in the navbar for everyone. Rejected because the anonymous navbar is intentionally minimal — anything other than auth CTAs dilutes the conversion goal of the visitor home.

### Privacy filter is `profile_visibility = 'public'` AND not in an exclusion set

The directory query filters:

1. `profile_visibility = 'public'` — Mastodon-style locked accounts opt out by their visibility setting, same as `/users/:username/followers` already enforces.
2. **Banned/suspended users** — when those statuses exist (they don't yet; this is a forward-compat scaffold). The query should be written so adding a `status` column or similar is a one-line filter change, not a query rewrite.
3. **Demo persona** — `apps/journal/app/lib/demo-bot.server.ts` exposes the persona username; exclude it from the directory so the demo bot doesn't appear in real discovery.

The query lives in `apps/journal/app/lib/explore.server.ts`. Tests cover each exclusion as a separate scenario.

## Risks / Trade-offs

- **Cold-start UX at 4 users.** The directory will be tiny. → Acceptable; the "Active recently" strip handles the "looks empty" feeling, and the public activity feed on logged-out `/` already does the same job from the content angle.
- **Recency ordering tilts toward power users.** A user who posts daily will perpetually outrank a quieter user. → Acceptable for v1; if it becomes a fairness issue we add a tiebreaker (e.g., bucket by week, randomize within bucket). Don't optimize speculatively.
- **No search.** A user looking for a specific handle can't search. → Mitigated by `/users/<username>` working directly. Search is a v2 follow-up.
- **Federation collision.** Once federation lands, the directory will need a "local" / "remote" distinction. → The capability spec says "local users" explicitly; remote-actor discovery is a `social-federation` add-on that can introduce its own surface or extend `/explore` later.

## Migration Plan

No data migration. The directory is a JOIN of existing `users` and `activities` rows. Deploy is a normal app rollout. Rollback is reverting the route registration in `routes.ts`.

## Open Questions

- **Bio in the directory row?** The user table has a `bio` column. Showing the first ~120 chars per row gives the directory more character but pads the layout. Default plan: include a truncated bio. Easy to drop if it's noisy.
- **Follower count visible in the directory?** Default plan: yes (mirrors how `/users/:username` shows it). A dissenter could argue this creates social-pressure metric-anxiety; counter-argument is that Mastodon, the comparable, shows it.
- **Does `/explore` deserve its own SSE event for follow-state changes?** The Follow button on a row should reflect "you just followed this person" without a hard reload. Today the FollowButton component handles this via local state on `/users/<username>`; the same pattern works on `/explore` with the same component. No new SSE channel needed.
