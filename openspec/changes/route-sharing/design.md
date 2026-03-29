## Context

The Journal stores routes in `journal.routes` with an `ownerId` foreign key to
`journal.users`. Route versions live in `journal.route_versions` with a
`routeId` reference. Activities live in `journal.activities` with an `ownerId`.
Currently, all route access is implicitly owner-only: the route detail loader
returns the route regardless of who requests it, but the route list only shows
the current user's routes. There is no visibility column, no sharing table, and
no permission checks beyond ownership.

The architecture doc defines a permission matrix with private/public/shared
visibility, view/edit permission levels, and forking. The original
`route-features` spec designed these alongside spatial search, multi-day routes,
and photos. This design covers only the sharing, permissions, and forking scope.

## Decisions

### D1: Visibility enum -- private and public

Add a `visibility` column to `journal.routes` and `journal.activities` using a
PostgreSQL enum type `journal.visibility_enum` with values `private` and
`public`. Default is `private`.

```sql
CREATE TYPE journal.visibility_enum AS ENUM ('private', 'public');
ALTER TABLE journal.routes ADD COLUMN visibility journal.visibility_enum NOT NULL DEFAULT 'private';
ALTER TABLE journal.activities ADD COLUMN visibility journal.visibility_enum NOT NULL DEFAULT 'private';
```

In Drizzle:

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const visibilityEnum = journalSchema.enum("visibility_enum", ["private", "public"]);

// On routes table:
visibility: visibilityEnum("visibility").notNull().default("private"),

// On activities table:
visibility: visibilityEnum("visibility").notNull().default("private"),
```

Only two values for now. A `followers_only` value can be appended to the enum
later when the follow system exists. Starting minimal avoids unused code paths
and UI states.

### D2: Route shares table

Create `journal.route_shares` to store per-user sharing permissions:

```typescript
export const routeSharePermission = journalSchema.enum(
  "route_share_permission",
  ["view", "edit"],
);

export const routeShares = journalSchema.table("route_shares", {
  id: text("id").primaryKey(),
  routeId: text("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permission: routeSharePermission("permission").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

A unique constraint on `(routeId, userId)` prevents duplicate shares. If the
owner updates a share, the existing row is replaced (upsert). Deleting a share
revokes access immediately.

The table is intentionally simple: one row per user per route. No expiry, no
"pending" state. The owner shares, the recipient sees it. This matches the
architecture doc's "simple permissions" decision.

### D3: Permission functions

Create `apps/journal/app/lib/permissions.server.ts` with two core functions:

```typescript
async function canView(routeId: string, userId: string | null): Promise<boolean>;
async function canEdit(routeId: string, userId: string | null): Promise<boolean>;
```

Logic for `canView`:
1. If user is the route owner: **yes**
2. If route visibility is `public`: **yes** (even if userId is null)
3. If user has a route_share with `view` or `edit` permission: **yes**
4. Otherwise: **no**

Logic for `canEdit`:
1. If user is the route owner: **yes**
2. If user has a route_share with `edit` permission: **yes**
3. Otherwise: **no**

Note: public visibility grants view access but never edit access. Edit access
requires either ownership or an explicit `edit` share.

These functions are used in:
- **Route detail loader**: Replace the current unconditional fetch with a
  `canView` check. Return 404 (not 403) for unauthorized access to avoid
  revealing route existence.
- **Route list loader**: Query own routes + routes shared with the user.
  Public routes are not shown in the list (they are discoverable via the
  explore page in a future change).
- **Route edit action**: Check `canEdit` before allowing updates.
- **Edit-in-Planner API**: Check `canEdit` before generating a Planner session.
- **GPX download API**: Check `canView` before serving GPX.

### D4: Forking

Forking copies a route and its latest GPX into the current user's collection.
Only public routes can be forked (shared routes cannot -- the owner explicitly
chose to share, not to allow copying).

Schema addition on `journal.routes`:

```typescript
forkedFromId: text("forked_from_id").references(() => routes.id, { onDelete: "set null" }),
```

`onDelete: "set null"` means if the original route is deleted, the fork remains
but loses the provenance link. This is correct -- the fork is an independent
copy.

Fork API route (`api.routes.$id.fork.ts`):
1. Verify user is logged in
2. Load the source route, check visibility is `public`
3. Create a new route with:
   - `ownerId`: current user
   - `name`: same as original (user can rename later)
   - `description`: same as original
   - `gpx`: copy of current GPX
   - `geom`: copy of current geometry
   - `routingProfile`, `distance`, `elevationGain`, `elevationLoss`: copied
   - `forkedFromId`: source route ID
   - `visibility`: `private` (forks start private)
4. Create a v1 route version with the copied GPX
5. Redirect to the new route's detail page

UI: A "Fork" button appears on the route detail page when:
- The route is public
- The viewer is logged in
- The viewer is not the owner

The route detail page shows "Forked from [Original Route Name]" with a link
when `forkedFromId` is set and the original route still exists and is viewable.

### D5: Contributor tracking

Add a `contributors` text array column to `journal.route_versions`:

```typescript
contributors: jsonb("contributors").$type<string[]>(),
```

This stores user IDs (not usernames) of people who contributed to this version.
For now this is populated from the JWT callback: the Planner session callback
includes the JWT which identifies the route and the user who initiated the
session. When the callback saves a new version, the contributor is the user
associated with the JWT token.

In the callback handler (`api.routes.$id.callback.ts`):
1. Decode the JWT to get the user identity (already done for auth)
2. Pass the contributor user ID to the version creation function
3. Store it in the `contributors` array on the new version row

For self-saves (owner editing via Planner), the contributor is the owner. For
cross-instance edits (future federation), the contributor would be the remote
user's ActivityPub URI.

Display on the route detail page: each version in the version history shows
contributor names/usernames. The route header shows a combined list of all
unique contributors across versions.

### D6: Share dialog

The share dialog is a modal accessible from the route detail page (owner only).
It provides:

1. **User search**: A text input that searches users by username or display name.
   Uses an API endpoint (`api.users.search.ts`) that returns matching users
   (excluding the route owner). Search is debounced (300ms) and returns at most
   10 results.

2. **Permission selector**: For each user in the share list, a dropdown with
   `view` or `edit`. Defaults to `view`.

3. **Current shares**: Shows users the route is already shared with, their
   permission level, and a remove button.

4. **Actions**: "Share" button adds the selected user with the chosen permission.
   "Remove" button revokes a share.

The dialog uses form submissions (React Router actions) for mutations, keeping
it server-rendered and progressive. The user search uses a client-side fetch to
the search API for responsiveness.

### D7: Visibility toggle

A simple toggle on the route detail page (owner only) that switches between
private and public. Implemented as a form with a hidden intent field:

```html
<form method="post">
  <input type="hidden" name="intent" value="toggleVisibility" />
  <button type="submit">Make Public / Make Private</button>
</form>
```

The toggle shows the current state clearly: "This route is private" with a
"Make public" button, or "This route is public" with a "Make private" button.
Making a route private does not revoke existing shares -- shared users retain
their access. This is intentional: visibility controls anonymous access, shares
control named-user access.

The same pattern applies to activities: a visibility toggle on the activity
detail page.

### D8: Privacy manifest update

The privacy page (`apps/journal/app/routes/privacy.tsx`) must document:

- **Route visibility**: Routes and activities have a visibility setting
  (private or public). Public routes are viewable by anyone with the link.
- **Route sharing**: Owners can share routes with specific users. Shared users
  can see the route name, description, and GPX data according to their
  permission level.
- **Forking**: Public routes can be forked (copied) by other users. The fork
  is an independent copy -- changes to the fork do not affect the original and
  vice versa.
- **Contributor tracking**: When you edit someone's route via the Planner, your
  user ID is recorded as a contributor on that version.

## Risks / Trade-offs

- **No followers-only visibility**: Starting with just private/public is
  simpler but means there is no middle ground. Users who want to share with
  followers but not the world must use per-user shares. This is acceptable
  until the follow system exists.
- **Fork divergence**: Forks are fully independent copies. There is no mechanism
  to sync upstream changes or notify fork owners of updates. This is by design
  -- forks are for adaptation, not tracking.
- **Share revocation is immediate**: Removing a share immediately revokes access.
  If a shared user has the route open in a Planner session, they can finish
  their current session (the JWT is still valid) but cannot start a new one.
- **User search exposes usernames**: The user search API returns usernames and
  display names. This is necessary for sharing to work. Rate limiting on the
  search endpoint mitigates enumeration concerns.
- **404 vs 403**: Returning 404 for unauthorized access prevents route existence
  leaks but makes debugging harder for shared users who lost access. This is the
  standard privacy-first approach.
