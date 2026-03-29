## 1. Schema

- [ ] 1.1 Add `visibility_enum` PostgreSQL enum (`private`, `public`) to `packages/db/src/schema/journal.ts` using `journalSchema.enum()`
- [ ] 1.2 Add `visibility` column to `journal.routes` table, type `visibility_enum`, default `private`
- [ ] 1.3 Add `visibility` column to `journal.activities` table, type `visibility_enum`, default `private`
- [ ] 1.4 Create `journal.route_shares` table with columns: `id` (text PK), `routeId` (FK to routes, cascade delete), `userId` (FK to users, cascade delete), `permission` (enum: view/edit), `createdAt`. Add unique constraint on `(routeId, userId)`
- [ ] 1.5 Add `forkedFromId` nullable text column to `journal.routes`, FK to `routes.id` with `onDelete: "set null"`
- [ ] 1.6 Add `contributors` jsonb text array column to `journal.route_versions`
- [ ] 1.7 Run `pnpm db:push` and verify schema locally

## 2. Permissions Logic

- [ ] 2.1 Create `apps/journal/app/lib/permissions.server.ts` with `canView(routeId, userId)` and `canEdit(routeId, userId)` — owner always has full access, public routes viewable by anyone, shared routes respect permission level
- [ ] 2.2 Update route detail loader (`routes.$id.tsx`) to check `canView` — return 404 for unauthorized. Pass `canEdit` result to the component for conditional UI (edit button, share button)
- [ ] 2.3 Update route list loader (`routes._index.tsx`) to include routes shared with the current user alongside owned routes

## 3. Sharing UI

- [ ] 3.1 Add visibility toggle to route detail page (owner only): form with `intent=toggleVisibility`, shows current state and toggle button
- [ ] 3.2 Create user search API route (`api.users.search.ts`): accepts `q` query param, returns matching users by username/display name (max 10, excludes requesting user), debounce-friendly
- [ ] 3.3 Create share dialog component and integrate on route detail page (owner only): user search input, permission dropdown (view/edit), current shares list with remove button. Uses form actions for add/remove share

## 4. Forking

- [ ] 4.1 Create fork API route (`api.routes.$id.fork.ts`): verify user is logged in, source route is public, copy route + latest GPX + metadata to user's collection with `forkedFromId` set, create v1 version, redirect to new route
- [ ] 4.2 Add "Fork" button on route detail page: visible when route is public, viewer is logged in, and viewer is not the owner
- [ ] 4.3 Show "Forked from [route name]" link on route detail page when `forkedFromId` is set and original route is viewable

## 5. Contributor Tracking

- [ ] 5.1 Update Planner callback handler (`api.routes.$id.callback.ts`): extract contributor identity from JWT, pass to version creation
- [ ] 5.2 Update `updateRoute` in `routes.server.ts` to accept and store `contributors` array on new route version rows
- [ ] 5.3 Display contributors on route detail page: per-version contributor names in version history, combined unique contributors in route header

## 6. Privacy & i18n

- [ ] 6.1 Update privacy manifest page (`privacy.tsx`): document route visibility settings, sharing behavior, forking, and contributor tracking
- [ ] 6.2 Add i18n keys (en + de) for: visibility labels (private/public), share dialog strings, fork button/label, contributor display, "forked from" text

## 7. Testing

- [ ] 7.1 Unit tests for `permissions.server.ts`: owner access, public access, shared view/edit access, no access, null user on public route
- [ ] 7.2 Unit tests for fork logic: successful fork of public route, reject fork of private route, forkedFromId set correctly, fork starts as private
- [ ] 7.3 E2E test: create route, toggle visibility to public, verify accessible when logged out
- [ ] 7.4 E2E test: share route with another user at view level, verify they can see it but not edit; share at edit level, verify edit access
