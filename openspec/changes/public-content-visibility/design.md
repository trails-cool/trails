## Context

The Journal uses a straightforward "logged-in or you're not seeing anything" access model today. Routes and activities are owned by a single user via `owner_id` foreign keys, and every detail-page loader calls `getSessionUser(request)` then either serves the page or (implicitly) returns the "route not found" error. There is no notion of cross-user visibility.

The Planner is separately anonymous, so that's not a concern here — this change is Journal-only.

Two near-term pressures shape the design:

- **The demo plan** (send a URL to a prospective user or contributor and have them see real content without signing up). Anything that requires a friction step on arrival defeats the demo.
- **Upcoming `demo-activity-bot`** that generates synthetic activities. That content has to be publicly viewable or the bot is pointless.

What this design deliberately *does not* touch:
- Followers / subscriptions / per-user feeds
- Reactions / comments / any write surface for non-owners
- ActivityPub / Fedify / federation
- Per-segment privacy on a single route

Those are all future chapters. Keeping the first step narrow means less to get wrong and less to re-design later.

## Goals / Non-Goals

**Goals:**
- A route or activity owner can mark a piece of content as public.
- Logged-out visitors can open that content at its permanent URL.
- A logged-out visitor can find the rest of that user's public content via `/users/:username`.
- Sharing a public URL on Slack / Twitter / Bluesky / email produces a decent preview.
- Default stays private — nothing already in the database becomes visible just because this change ships.

**Non-Goals:**
- Discovery (there is no "browse public routes" page on the instance yet).
- Indexing control beyond the default (no per-route `robots` override).
- Changing the Planner's anonymous model.
- Any write access for non-owners on public content.

## Decisions

### Visibility model: three values, not two

**Decision:** `visibility` enum `'private' | 'unlisted' | 'public'`. Stored as a text column for simplicity; can be migrated to a native enum later if worth it.

- `private` (default) — only the owner can fetch the detail page; listings never show it.
- `unlisted` — anyone with the URL can view; excluded from the owner's public profile and any future discovery pages.
- `public` — anyone can view; appears on the owner's public profile.

**Alternatives:**
- **Just `private | public`** — simpler, but kills the useful "I want to share with someone without putting it on my profile" case. Every other sharing-oriented service has an unlisted tier; it's cheap to add now and irritating to retrofit later.
- **Sharing via time-limited tokens** (Google-Docs-style) — more powerful but out of scope for the demo goal. Parked.

### Default is `private` for all existing rows

**Decision:** The new column ships with `DEFAULT 'private'` and every existing row — two real routes and zero activities — remains private. Users opt in to publication by explicitly changing the value.

**Why:** This change cannot silently un-privatise data anyone uploaded under the old rules. That principle outweighs the demo inconvenience (we'll mark the demo user's seeded content public at insert time).

### Access check lives in route loaders

**Decision:** Each detail-page loader (`routes.$id.tsx`, `activities.$id.tsx`) resolves the content row, compares `visibility` + `owner_id` against the session user:

- `visibility === 'public'` → serve.
- `visibility === 'unlisted'` AND the request is a direct detail page URL → serve.
- otherwise → serve only if the requester is the owner, else 404 (not 403 — leaking existence is a privacy bug).

A small helper `canView(content, user)` in `~/lib/auth.server` centralises the rule so list endpoints use the same logic.

**Alternatives:**
- **Route-level middleware** (before loaders) — cleaner in theory but React Router 7 loaders are the right place for content-specific auth, and centralising via a helper avoids coupling the router tree to visibility semantics.

### Public profile page reuses the existing `/users/:username` route

**Decision:** That route exists today but is auth-gated (and renders the current user's own routes/activities). Broaden it:

- Publicly accessible.
- Shows public routes + public activities of the requested username, most recent first.
- 404 if the user has no public content at all. This hides the existence of private-only accounts; an attacker can't enumerate accounts by username.
- A "This is your profile" control strip visible only to the logged-in owner, with a quick link to settings.

### Open Graph / Twitter Card meta tags

**Decision:** Each public route / activity detail page emits OG tags via React Router's `meta` export:

- `og:title` — route or activity name + "· trails.cool"
- `og:description` — user description (truncated) or a sensible default
- `og:type` — `"article"`
- `og:site_name` — `"trails.cool"`
- `twitter:card` — `"summary"` (summary, not summary_large_image; we don't have social cards yet)

A future `social-preview-images` follow-up can add rendered static map PNGs. Explicitly out of scope here.

### `robots` control

**Decision:** Public route / activity pages emit no `robots` meta (defaults to indexable). The legal pages keep their existing `noindex`. No sitemap is generated; discovery via search is passive.

## Risks / Trade-offs

- **Username enumeration via profile 404** → Mitigation: 404 both for "no such user" and "user exists but has no public content", so the two are indistinguishable. Timing-side-channel on the DB lookup is not defended against in v1; acceptable at this scale.
- **Future listing pages will want more data** → The `canView` helper already supports it. Adding an `index` boolean or "discoverable" flag is additive.
- **`unlisted` is only private-ish** → If the URL leaks it's effectively public. That's the Internet; same as every other unlisted-sharing feature. Documented in the settings UI copy.
- **Content previously private becomes linkable** → Once a user makes a route public and shares it, they can't fully retract — archives exist. Same as any web publish. No new warning for v1; the visibility selector itself is unambiguous.
- **Spec drift risk** → `route-management` and `activity-feed` both gain modified requirements; keep the delta specs tight so the archive survives review.

## Migration Plan

1. Merge schema change; `drizzle-kit push --force` on deploy adds the column with default `'private'`.
2. Logged-out access to public pages is a new code path — nothing existing regresses since all rows remain `'private'` until a user changes them.
3. `demo-activity-bot` is the first caller that will create rows with `visibility: 'public'` at insert time.
4. Rollback: `UPDATE routes SET visibility = 'private'; UPDATE activities SET visibility = 'private';` restores the prior behaviour without any code change; the public code path becomes dead but harmless.

## Open Questions

- Should the settings page add a default-visibility preference per user (e.g. "make new routes public by default")? Probably nice but not in this spec; revisit after observing real usage.
- Do we want to emit `<link rel="canonical">` on unlisted pages to discourage indexing of the URL if it leaks? Low-cost, worth considering during implementation.
