## 1. Schema

- [ ] 1.1 Add `visibility text NOT NULL DEFAULT 'private'` to `journal.routes` in `packages/db/src/schema/journal.ts`
- [ ] 1.2 Add the same column to `journal.activities` in the same file
- [ ] 1.3 Export a shared type `type Visibility = 'private' | 'unlisted' | 'public'` from `packages/db/src/schema/journal.ts` (or a small adjacent module) and reuse at the app layer

## 2. Server-side access helper

- [ ] 2.1 Add `canView(content, user)` in `apps/journal/app/lib/auth.server.ts` that returns `true` for `public`, `true` for `unlisted` (the direct-URL case — callers pass `true` when routed to a detail page, `false` when generating listings), and ownership-checked otherwise
- [ ] 2.2 Unit test the three matrix cells

## 3. Route detail access

- [ ] 3.1 Update `apps/journal/app/routes/routes.$id.tsx` loader: fetch route, then apply `canView`; return 404 when not allowed
- [ ] 3.2 Expose `visibility` on the loader's returned shape so the component can render the current-visibility badge to the owner
- [ ] 3.3 Emit Open Graph / Twitter Card `meta` for `public` and `unlisted` routes (title, description, `og:type="article"`, `og:site_name="trails.cool"`, `twitter:card="summary"`)

## 4. Activity detail access

- [ ] 4.1 Mirror 3.1 in `apps/journal/app/routes/activities.$id.tsx`
- [ ] 4.2 Mirror 3.3 for activities

## 5. Visibility selector in the edit flow

- [ ] 5.1 Add a visibility `<select>` to `apps/journal/app/routes/routes.$id.edit.tsx`
- [ ] 5.2 Wire the form action in `routes.$id.tsx` / the edit route to persist the new value via `updateRoute`
- [ ] 5.3 Add i18n keys (EN + DE) for `routes.visibility.{label,private,unlisted,public,privateHelp,unlistedHelp,publicHelp}`
- [ ] 5.4 Do the same for activities (no separate edit page exists yet — either add a minimal one or surface the selector on the detail page for the owner; pick during implementation)

## 6. Listing filters

- [ ] 6.1 Update `listRoutes(userId)` in `apps/journal/app/lib/routes.server.ts` to accept a `viewerUserId: string | null` and filter to rows where `visibility='public'` OR `owner_id = viewerUserId`
- [ ] 6.2 Same for `listActivities` in the activities equivalent
- [ ] 6.3 Audit any other query that returns routes/activities across users and apply the same filter (grep `users.id` / `owner_id` joins)

## 7. Public profile page

- [ ] 7.1 Broaden `apps/journal/app/routes/users.$username.tsx` loader to not require auth
- [ ] 7.2 Fetch the user row by username; return 404 if no such user
- [ ] 7.3 Fetch that user's `public` routes and `public` activities via the updated listing filters
- [ ] 7.4 Return 404 if the user exists but has no public content at all (prevents account enumeration)
- [ ] 7.5 Render the profile header (display name, `@username@domain` handle), reverse-chronological lists, and an owner-only "This is your profile" control strip linking to settings
- [ ] 7.6 Emit Open Graph meta (`og:title`, `og:site_name`, `og:type="profile"`)

## 8. Copy + docs

- [ ] 8.1 Add a short sentence to the Privacy Manifest (`legal.privacy.tsx`) noting public content is world-visible and exportable the same way
- [ ] 8.2 Bump `PRIVACY_LAST_UPDATED` in `apps/journal/app/lib/legal.ts` and add a new snapshot under `docs/legal-archive/`

## 9. Testing

- [ ] 9.1 Unit: `canView` matrix (private/unlisted/public × owner/other/anon)
- [ ] 9.2 E2E: logged-out visitor can view a public route page; gets 404 on a private one
- [ ] 9.3 E2E: owner marks a route public, logs out, can still view it at the same URL
- [ ] 9.4 E2E: `/users/:username` 404s for a user with no public content, renders for one with at least one public item
- [ ] 9.5 E2E: OG tags are present on public detail pages (assert via `page.locator('meta[property="og:title"]')`)

## 10. Rollout

- [ ] 10.1 Merge schema + code; `drizzle-kit push --force` adds the column with `'private'` default — no row changes
- [ ] 10.2 Confirm on prod that the three existing users' routes/activities are still auth-only (they should be, since all rows default to `private`)
- [ ] 10.3 Hand off to `demo-activity-bot` which inserts with `visibility: 'public'` directly
