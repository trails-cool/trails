## 1. Schema

- [x] 1.1 Add `visibility text NOT NULL DEFAULT 'private'` to `journal.routes` in `packages/db/src/schema/journal.ts`
- [x] 1.2 Add the same column to `journal.activities` in the same file
- [x] 1.3 Export a shared type `type Visibility = 'private' | 'unlisted' | 'public'` from `packages/db/src/schema/journal.ts` (or a small adjacent module) and reuse at the app layer

## 2. Server-side access helper

- [x] 2.1 Add `canView(content, user)` in `apps/journal/app/lib/auth.server.ts` that returns `true` for `public`, `true` for `unlisted` (the direct-URL case — callers pass `true` when routed to a detail page, `false` when generating listings), and ownership-checked otherwise
- [x] 2.2 Unit test the three matrix cells

## 3. Route detail access

- [x] 3.1 Update `apps/journal/app/routes/routes.$id.tsx` loader: fetch route, then apply `canView`; return 404 when not allowed
- [x] 3.2 Expose `visibility` on the loader's returned shape so the component can render the current-visibility badge to the owner
- [x] 3.3 Emit Open Graph / Twitter Card `meta` for `public` and `unlisted` routes (title, description, `og:type="article"`, `og:site_name="trails.cool"`, `twitter:card="summary"`)

## 4. Activity detail access

- [x] 4.1 Mirror 3.1 in `apps/journal/app/routes/activities.$id.tsx`
- [x] 4.2 Mirror 3.3 for activities

## 5. Visibility selector in the edit flow

- [x] 5.1 Add a visibility `<select>` to `apps/journal/app/routes/routes.$id.edit.tsx`
- [x] 5.2 Wire the form action in `routes.$id.tsx` / the edit route to persist the new value via `updateRoute`
- [x] 5.3 Add i18n keys (EN + DE) for `routes.visibility.{label,private,unlisted,public,privateHelp,unlistedHelp,publicHelp}`
- [x] 5.4 Surface the selector on the activity detail page for the owner (simpler than a new edit page); new `updateActivityVisibility` helper + `set-visibility` action intent

## 6. Listing filters

- [x] 6.1 Added `listPublicRoutesForOwner(ownerId)` — returns only public rows for profile listings. `listRoutes(ownerId)` stays as-is (owners see their own content regardless of visibility, per spec)
- [x] 6.2 Added `listPublicActivitiesForOwner(ownerId)` with the same shape
- [x] 6.3 Audited all callsites of `listRoutes` / `listActivities` / raw selects on `from(routes|activities)` — every path already passes the session user's own id, so no cross-user leaks. Cross-user surface is new (profile page) and uses the public-only helpers.

## 7. Public profile page

- [x] 7.1 The loader never required auth (it was already public-accessible); kept that way
- [x] 7.2 Fetch user row by username; 404 if missing
- [x] 7.3 Fetch public routes + public activities via the new `listPublicRoutesForOwner` / `listPublicActivitiesForOwner`
- [x] 7.4 404 when user has no public content AND the viewer isn't the owner (owners still see their own empty profile)
- [x] 7.5 Rendered profile header, reverse-chron lists, owner-only note linking to settings
- [x] 7.6 Open Graph + Twitter Card meta (`og:title`, `og:description`, `og:type="profile"`, `og:site_name`)

## 8. Copy + docs

- [x] 8.1 Privacy Manifest: added a bullet in the Journal section explaining the visibility flag and that `public` content is world-visible
- [x] 8.2 Bumped `PRIVACY_LAST_UPDATED` to 2026-04-20 and rendered `docs/legal-archive/privacy-2026-04-20.md`

## 9. Testing

- [x] 9.1 Unit: `canView` matrix (13 cases across private/unlisted/public × owner/other/anon × asDirectLink)
- [x] 9.2 E2E: private route returns 404 to logged-out visitor; public route renders
- [x] 9.3 E2E: owner can view their own private route; unlisted reachable on direct URL but omitted from profile
- [x] 9.4 E2E: `/users/:username` 404s when no public content; renders when there's at least one public route
- [x] 9.5 E2E: OG tags (`og:title`, `og:type=article`, `og:site_name`) present on public route pages

## 10. Rollout

- [x] 10.1 Schema ships with `drizzle-kit push --force` — column default `'private'`, no row changes on prod
- [x] 10.2 (Post-deploy check) Confirm on prod that existing users' routes/activities remain auth-only — handled at merge time, not in this PR
  - Verified post-merge on trails.cool: `journal.routes` and `journal.activities` both have `column_default = 'private'::text`, NOT NULL. Current row counts — routes: 6 private / 15 public; activities: 11 private / 15 public — the publics on both sides are the demo-bot (bruno) seeded content per task 10.3. No existing user content leaked public.
- [x] 10.3 (Next change) `demo-activity-bot` will insert with `visibility='public'` directly — not in this PR
  - Confirmed landed in the `demo-activity-bot` change: `apps/journal/app/lib/demo-bot.server.ts:564,585` set `visibility: "public"` on both route and activity inserts.
