# Information Architecture Review

*Snapshot date: 2026-04-26.* If the navbar, route table, or feed model has
shifted since then, treat this doc as stale and refresh against
`apps/journal/app/routes.ts` + `apps/journal/app/root.tsx`.

To regenerate this doc (fresh or refresh), invoke the **`/ia-review`**
skill — it walks the route tables + nav surfaces, builds the sitemap,
flags drift since this snapshot, and preserves the decisions/backlog
already captured below. The companion **`/spec-drift-review`** skill
does the equivalent for `openspec/specs/` against shipped code.

A snapshot of where every page lives, who sees it, and how visitors navigate
between them. Intended for review — flag anything that doesn't make sense or
should change.

## Apps

trails.cool ships two front-ends:

- **Journal** (`trails.cool`) — user accounts, social, content. Most of the IA
  question lives here.
- **Planner** (`planner.trails.cool`) — anonymous, ephemeral. Five routes
  total; not a real IA concern. Listed at the bottom for completeness.

---

## Journal sitemap

### Public surface (logged-out)

```
/                              Anonymous home (hero + marketing + public feed)
/users/:username               Public profile (full or locked stub)
/users/:username/followers     Followers list (404 on private profile)
/users/:username/following     Following list (404 on private profile)
/activities/:id                Public activity (or 404)
/routes/:id                    Public route (or 404)

/auth/register                 Sign-up
/auth/login                    Sign-in
/auth/verify                   Magic-link click-through landing
/auth/accept-terms             Re-accept gate (used after a Terms version bump)

/legal/imprint                 Imprint (German required)
/legal/privacy                 Privacy policy
/legal/terms                   Terms of service
/privacy                       301 → /legal/privacy
```

### Authenticated surface (logged-in)

```
/                              Personal dashboard ("your activities" stream)
/feed                          Social feed (people you follow, accepted)
/notifications                 Notifications log (4 event types, cursor paginated)
/follows/requests              Incoming Pending follow requests inbox

/users/:username               Any profile (own, followed, or locked stub)
/users/:username/followers     Gated by locked-account rule
/users/:username/following     Gated by locked-account rule

/routes                        Your routes
/routes/new                    Create route
/routes/:id                    View
/routes/:id/edit               Edit (handoff to Planner via JWT callback)

/activities                    Your activities
/activities/new                Create activity
/activities/:id                View

/settings                      Profile + email + passkeys + sync + danger zone

/sync/import/:provider         Wahoo import flow
/auth/logout                   Logout
```

### Navigation surfaces

**Top navbar (logged-in)** — in document order:

```
[trails.cool]   Feed   Routes   Activities   ...   🔔   Follow requests   <username>   Settings   Logout
                                                  └─ unread badge        └─ pending badge
```

**Top navbar (logged-out):**

```
[trails.cool]   ...   Login   [Register]
```

**Footer (everywhere):** Imprint · Privacy · Terms · Source (GitHub) · "Alpha".

**Profile self-link in nav** points to `/users/<self>`. There is no separate
"My profile" route; you reach your own profile via your own username.

---

## Logged-in vs logged-out home

`/` does double duty:

| Visitor | What `/` shows |
|---|---|
| Anonymous | Hero · Sign-up CTAs · "Try the Planner" · marketing cards (flagship only) · **public instance feed** |
| Signed-in | "Welcome, X" · Feed button · "New activity" CTA · **personal stream of your own activities** |

The two surfaces share no layout — they're effectively two pages behind one
URL. `home.tsx` branches on `user`.

---

## Two feed surfaces, three views

**Decision (2026-04-26):** merge Social and Public into a single `/feed`
page with a Followed / Public toggle. `/` stays "your content," `/feed`
becomes "everyone else's content."

| Surface | View | Audience |
|---|---|---|
| `/` (logged-in) | **Personal** — your own activities | You |
| `/feed` | **Followed** (default) — accepted-followed users' public activities | Signed-in |
| `/feed?view=public` | **Public** — instance-wide public activities | Signed-in |
| `/` (logged-out) | Hero + marketing + public feed (visitor entry point) | Anonymous |

Signed-in users can now see the public instance feed without logging out.
The logged-out `/` keeps its public feed as the anonymous visitor's first
impression.

Implementation notes (for whoever picks this up):

- `listSocialFeed` and `listRecentPublicActivities` already exist in
  `apps/journal/app/lib/activities.server.ts` — the toggle just picks one.
- URL shape: `?view=followed` (default, can omit) | `?view=public`. Keeps the
  toggle bookmarkable and avoids two routes.
- Empty-state in the Followed view today links to `/` ("see the public feed
  there") — that link should become the in-page Public toggle.
- Anonymous request to `/feed` keeps redirecting to `/auth/login`; the
  public feed remains reachable for them on `/`.

---

## Notifications vs follow requests

Two adjacent inboxes, two navbar entries:

| | `/notifications` | `/follows/requests` |
|---|---|---|
| Purpose | Read-only event log | Actionable Approve/Reject |
| Types covered | follow_received, follow_request_received, follow_request_approved, activity_published | Only Pending follows targeting you |
| Navbar surface | 🔔 icon + red unread badge | "Follow requests" text + red pending count |
| State | `read_at` per row | None — Approve/Reject mutates the follow row |

A `follow_request_received` notification points its "Review request" link at
`/follows/requests`, so the two surfaces are explicitly cross-linked rather
than merged. Mastodon makes the same split.

---

## Settings

`/settings` is a single scrollable page with five concerns stacked top to
bottom:

1. Profile (display name, bio, profile visibility)
2. Email change (with re-verification)
3. Passkeys (list, add, delete)
4. Connected services (Wahoo today, Strava/Garmin later)
5. Danger zone (delete account)

Spec was recently split into three (`profile-settings`, `account-management`,
`connected-services`) but the UI is still one page.

---

## Cross-app linking

- **Journal → Planner:** "Edit in Planner" on a saved route generates a JWT
  callback URL and opens `planner.trails.cool/session/<id>`. Logged-out home
  also has a "Try the Planner" link.
- **Planner → Journal:** the post-edit "Save" flow POSTs back to
  `/api/routes/:id/callback` on the Journal that issued the JWT.
- The Planner has no link back to a specific Journal otherwise — it's
  intentionally instance-agnostic.

---

## Planner sitemap

```
/                              Anonymous home (CTA: "Plan a route")
/new                           Create a fresh anonymous session
/session/:id                   Collaborative editor
```

No accounts, no profiles, no settings. IA is essentially trivial.

---

## Observations worth discussing

These are tensions or surprises I noticed while mapping. None are bugs — but
each is a deliberate IA choice that's worth confirming.

1. **`/` is two different products.** Logged-in `/` is "your stuff," logged-out
   `/` is "the instance." Discoverable? Or should logged-in `/` keep showing
   *something* of the public surface (e.g., a "Discover" tab)?
   *Status: open — not sure yet if this needs resolving.*

2. ~~**Signed-in users can't see the public instance feed.**~~ *Resolved:
   merged into `/feed` with a Followed / Public toggle (see above).*

3. ~~**The navbar's account cluster is busy.**~~ *Folded into Stream C
   (navbar redesign): regroup the cluster behind an avatar dropdown.*

4. ~~**`/feed` is reachable from both the navbar AND a button on the home
   page.**~~ *Decision: drop the button on logged-in `/` — the navbar
   entry is enough. See Stream D.*

5. ~~**🔔 vs "Follow requests" are visually inconsistent.**~~ *Resolved by
   Stream B — Follow requests folded into the bell as a Requests tab, so
   there's a single inbox icon in the navbar.*

6. **Routes and Activities are siblings, not nested.** That's correct today —
   an activity can exist without a route, and vice versa. *Flagged for a
   broader review: the concept of routes-vs-activities, plus the impending
   word collision with social "activities" (comment, like, publish) once
   federation lands. Tracked separately — see "Open exploration"
   below.*

7. ~~**`/settings` is one page.**~~ *Decision: break it apart. See Stream E.*

8. ~~**No `/explore`, no `/users` directory, no search.**~~ *Decision:
   propose an `/explore` spec. See Stream F.*

9. ~~**No mobile breakpoint for the navbar.**~~ *Decision: include mobile
   responsiveness in Stream C (navbar redesign).*

10. **Profile vs identity.** Your own profile is at `/users/<you>` not
    `/me` or `/profile`. Reachable via the navbar self-link. Fine, but means
    "view as logged-out visitor" is non-trivial — opening incognito is the
    only way to see your locked stub.
    *Status: open — no decision yet.*

---

## Open IA questions

If the answer to any of these is "I don't know yet," that's a signal it's
worth discussing before the navbar redesign locks in shapes:

- ~~Should `/` and `/feed` merge for signed-in users?~~ *Resolved:
  no — `/` stays "you," `/feed` becomes "everyone else" with a
  Followed / Public toggle.*
- ~~Where does an `/explore` or `/discover` page live?~~ *Resolved: it's
  the Public view inside `/feed`, no new top-level destination needed.*

---

## Implementation backlog

Decisions captured above translate into two work-streams. Items marked
*needs decision* are blockers — confirm before starting that stream.

### Stream A — Merge Social and Public feeds into `/feed`

**Code changes:**

1. **`apps/journal/app/routes/feed.tsx`**
   - Loader reads `?view=` query (`"followed"` default, `"public"` accepted;
     anything else falls back to default).
   - Branch the fetch: `listSocialFeed(user.id, 50)` for Followed,
     `listRecentPublicActivities(50)` for Public — both already exist in
     `apps/journal/app/lib/activities.server.ts`.
   - Render a toggle (two pills/tabs) at the top of the page; active state
     highlighted; toggle uses `<Link to="?view=public">` so it's plain HTTP,
     SSR-friendly, bookmarkable, and works without JS.
   - Per-view `<meta>` title: "Following — trails.cool" / "Public — trails.cool".
   - Per-view empty state: Followed view's existing "see the public feed"
     escape now links to `?view=public` instead of `/`.

2. **Translation keys (`apps/journal/app/locales/{en,de}/journal.json`)**
   - `social.feed.toggle.followed`, `social.feed.toggle.public`
   - `social.feed.public.heading`, `social.feed.public.empty`
   - Drop `social.feed.publicFeedLink` once the empty-state link is rewired.

3. **No change** to `apps/journal/app/routes/home.tsx` — logged-in `/` keeps
   showing the personal stream; the "Feed" button still targets `/feed`
   (defaults to Followed view).

4. **No change** to anonymous `/feed` behavior — it continues to redirect to
   `/auth/login`. The public feed remains visible to anonymous visitors on `/`.

**Spec updates after Stream A ships:**

- `openspec/specs/social-follows/spec.md` — the **Social activity feed**
  requirement currently scopes `/feed` to followed users only. Update it (or
  split into a new "Feed views" requirement) to add scenarios for the Public
  view and the toggle behavior.
- `openspec/specs/activity-feed/spec.md` — the **Instance-wide public
  activity feed** requirement says it powers the home page. Add a scenario
  noting it now also powers `/feed?view=public` for signed-in users.
- `openspec/specs/journal-landing/spec.md` — no change. Logged-in `/`
  already shows the personal stream; this is unchanged.

### Stream B — Merge Follow requests into Notifications  ✅ Shipped (PR #316)

**Decision (2026-04-26):** fold `/follows/requests` into `/notifications`
as a tabbed sub-page (Activity / Requests). The bell icon stays the
single inbox surface; the Requests tab shows a dot when there are pending
follows still needing Approve/Reject. The Notifications spec's existing
"no inline Approve/Reject on the activity log" rule is preserved — the
Requests tab is the actionable surface, the Activity tab is the log.

**Code changes:**

1. **`apps/journal/app/routes/notifications.tsx`**
   - Loader reads `?tab=` (`"activity"` default, `"requests"` accepted).
   - For Activity tab: existing behavior (paginated rows, `?before=` cursor).
   - For Requests tab: load `listPendingFollowRequests(user.id)` and
     `countPendingFollowRequests(user.id)` (already exist).
   - Page renders a tab strip at the top with both labels and an unread/
     pending dot per tab; active tab highlighted.
   - "Mark all read" button only appears on the Activity tab.

2. **`apps/journal/app/routes.ts`**
   - `route("follows/requests", ...)` becomes a redirect to
     `/notifications?tab=requests` (301). New file
     `routes/follows.requests.tsx` reduces to one `loader` returning a
     redirect, mirroring the existing `routes/privacy.tsx` pattern.

3. **`apps/journal/app/lib/notifications/link-for.ts`**
   - `follow_request_received` now resolves to
     `/notifications?tab=requests` instead of `/follows/requests`. Update
     the unit test in `link-for.test.ts`.

4. **`apps/journal/app/root.tsx`**
   - Drop the `Follow requests` navbar entry entirely.
   - Drop `pendingFollowRequests` from the root loader (no longer needed
     for navbar). The Requests tab loader inside `/notifications`
     fetches it on-demand.
   - Bell unread badge logic unchanged — `follow_request_received`
     already creates an unread row, so the existing unread count
     implicitly covers pending requests.

5. **i18n updates** (`packages/i18n/src/locales/{en,de}.ts`)
   - New keys: `notifications.tabs.activity`, `notifications.tabs.requests`.
   - The `settings.profile.visibility.privateHelp` string mentions
     `/follows/requests` — update to point at the new surface.

6. **e2e tests**
   - `e2e/social.test.ts`: the `/follows/requests redirects anonymous
     visitors to login` test changes to verify the new redirect target,
     and the "B sees the request in /follows/requests" step navigates
     to `/notifications?tab=requests` instead.
   - `e2e/notifications.test.ts`: same — replace `bPage.goto("/follows/requests")`
     with `bPage.goto("/notifications?tab=requests")`.

**Spec updates after Stream B ships:**

- `openspec/specs/notifications/spec.md` — extend the **Notifications
  page and unread count** requirement to describe the tabbed structure;
  refine the "follow_request_received card links to /follows/requests,
  not inline Approve/Reject" scenario to reflect the new URL and the tab
  separation. The `linkFor` scenarios need the updated path.
- `openspec/specs/social-follows/spec.md` — update the **Pending follow
  request management** requirement: navigation moves to
  `/notifications?tab=requests`; the navbar count badge requirement is
  retired (it's now a dot inside the Requests tab).
- `openspec/specs/journal-landing/spec.md` — the **Notifications entry
  in the navbar** requirement should clarify that this is the only
  inbox-style entry (no separate Follow requests entry).

### Stream C — Navbar redesign

**Scope (decided):**

- Regroup the account cluster (`<username>` + Settings + Logout) behind
  an avatar dropdown.
- Treat mobile responsiveness as a first-class concern in the redesign,
  not a phase-2 follow-up. Today the navbar wraps badly on phones.
- The bell + Requests tab from Stream B already gives the navbar a
  consistent inbox surface; nothing further needed there.

**Needs decision before implementation:**

- **Avatar dropdown content.** Profile · Settings · Logout — any others?
  (Theme toggle? Language toggle? Account switcher when federation lands?)
- **Mobile pattern.** Hamburger drawer? Bottom tab bar? Condensed top
  bar with the dropdown absorbing most controls?
- **Self-link vs avatar.** Today the navbar has a `<username>` text link
  to your profile. After the avatar dropdown, does the avatar take that
  role (click → profile, dropdown chevron → menu), or does Profile live
  only inside the dropdown?

### Stream D — Drop the redundant "Feed" button on logged-in `/`

**Decision (2026-04-26):** logged-in `/` no longer needs a "Feed" button
in the page header — the navbar entry is the single discoverable path.

**Code changes:**

- `apps/journal/app/routes/home.tsx` — remove the `<a href="/feed">`
  button next to the "New Activity" CTA in the signed-in branch
  (currently lines ~170–183). Keep "New Activity" as the only header
  action.
- No spec changes; `journal-landing/spec.md` has a **Social feed link
  for signed-in users** requirement that mentions a "Feed (or
  equivalent) link" — that requirement should be retired.

Tiny PR, ~5 lines + a spec update.

### Stream E — Break Settings apart

**Decision (2026-04-26):** `/settings` becomes a sectioned area rather
than a single scrollable page. Spec was already split into three
(`profile-settings`, `account-management`, `connected-services`); the UI
should follow.

**Needs decision before implementation:**

- **Layout pattern.** Tab strip on `/settings` (single URL, JS-driven
  tabs)? Nested routes (`/settings/profile`, `/settings/security`,
  `/settings/connections`, `/settings/danger`)? Sidebar nav?
- **Section list.** The current page has five concerns:
  1. Profile (display name, bio, profile visibility)
  2. Email (with re-verification)
  3. Passkeys
  4. Connected services (Wahoo today)
  5. Danger zone (delete account)
  Keep five? Merge "Email" into "Profile"? Pull "Danger zone" into
  "Account" alongside Email?

**Spec impact:** `profile-settings`, `account-management`, and
`connected-services` are already separate specs — they describe behavior,
not URL structure. Whichever URL pattern wins, only `journal-landing`
(or wherever the navbar currently sits) needs to know.

### Stream F — Propose an `/explore` spec

**Decision (2026-04-26):** the gap between "I want to find people to
follow" and "I have a username from outside" needs an in-app path.
Federation (Phase 2) makes this more valuable, but local-only `/explore`
is useful on day one.

**Approach:** kick off an OpenSpec proposal via `/opsx:propose` rather
than diving into code. The proposal phase decides:

- What `/explore` actually shows. A directory of all local users? A
  curated "active in the last N days" list? A randomized rotation? Just
  the public activity feed (which is currently buried on logged-out `/`)?
- Whether search is part of v1 or a follow-up.
- Where the link lives in the navbar (its own entry vs. inside `/feed`).
- Privacy: private profiles need to be excluded from any directory; this
  is the same locked-account access rule that already gates
  followers/following lists.

**Spec impact:** new spec file at
`openspec/specs/explore/spec.md` (or similar — name TBD by the proposal),
plus an entry in `CAPABILITIES.md`.

**Code changes (assuming avatar dropdown + icon-only Follow requests + no
mobile work yet):**

1. **`apps/journal/app/root.tsx`**
   - Add `displayName` to the loader's `user` payload (currently only
     `id` + `username`).
   - Replace the `<username> · Settings · Logout` cluster with a single
     avatar trigger + dropdown menu.
   - Replace the "Follow requests" text link with an icon-only button +
     badge (matching the bell's visual treatment).
   - Confirm bell + Follow requests sit on the same baseline / same gap.

2. **New components in `apps/journal/app/components/`**
   - `Avatar.tsx` — initials fallback when no image (none of our 4 prod
     users have an avatar field today, so this is initials-only initially).
   - `NavDropdown.tsx` — click-outside + Escape-to-close. Simple
     headless impl, no library.

3. **Loader query**
   - `getSessionUser` already returns `displayName`; just expose it in the
     loader return shape.

**Spec updates after Stream B ships:**

- `openspec/specs/journal-landing/spec.md` — currently has only the
  **Notifications entry in the navbar** requirement. Add a new
  requirement (or extend that one) for the account dropdown shape and the
  Follow-requests icon. Or factor the navbar out into its own spec —
  plausible if the cluster keeps growing.
- `openspec/specs/social-follows/spec.md` — the **Pending follow request
  management** requirement says "the 'Follow requests' link in the navbar
  renders with a small red count badge". Update the wording to reflect
  the icon treatment.
- `openspec/specs/notifications/spec.md` — the **Notifications page and
  unread count** requirement already says "navbar entry renders with a
  count badge"; verify the wording still applies cleanly to the icon-only
  treatment.

### Out of scope (deliberately)

These came up in the IA review but aren't part of this round:

- **`/me` alias for own profile.** Marginal value; navbar self-link is
  enough.
- **Mobile breakpoints across the app.** Bigger than just the navbar.
  Stream C handles the navbar; the rest of the app is a separate effort.

---

## Open exploration

Items that aren't ready for an implementation backlog because the
underlying *concept* still needs work, not just the UI.

### Routes vs Activities — terminology and model

The IA review flagged that Routes and Activities are sibling top-level
concepts. Two reasons to revisit this beyond the URL structure:

1. **Conceptual overlap.** A *route* is a planned path. An *activity*
   is a recorded outing (often along a route). Some apps (Strava,
   Komoot) collapse these into one timeline; we keep them split. Worth
   confirming the split still earns its keep.
2. **Word collision with social "activities".** Once federation lands
   (and arguably already, with the `activity_published` notification
   type), "activity" will be overloaded:
   - **Athletic activity:** a bike ride, a hike, a run.
   - **Social activity:** a comment, a like, a follow, a publish event.
     This is the ActivityPub sense — and it's the one that will appear
     in feeds, notifications, and remote inboxes.

   The collision is going to bite. ActivityPub uses "Activity" as a
   technical term throughout; the user-facing "Activity" (a ride) will
   constantly be next to ActivityPub Activities (a follow, a like) in
   logs, diagrams, and possibly UI strings.

**Plan:** dedicate a separate review doc (e.g.
`docs/routes-vs-activities.md`) to think this through before any spec
or code change. Open questions for that doc:

- Do we rename the user-facing "Activity" to something else (Outing?
  Trip? Ride? Record? Trace?) before federation cements the social
  meaning?
- Or do we keep "Activity" for the user-facing object and use "Event"
  or "Stream item" for the social/ActivityPub sense?
- Are Routes still needed as a top-level object, or could they be a
  subordinate concept of Activities (a "saved planned version" of
  something you may eventually ride)?
- What does the export/import story look like — GPX is route-shaped;
  Strava's TCX is activity-shaped; how do we want the model to talk
  about each?

Not urgent, but worth resolving before federation is far enough along
that renaming is a migration headache.
- **Is "Follow requests" a sub-page of Notifications or a sibling?** Today
  it's a sibling (separate navbar item). Could be a tab inside `/notifications`.
- **Avatar dropdown content.** Profile · Settings · Logout — anything else?
  (Theme toggle? Language toggle? Account switcher when federation lands?)
- **Mobile.** Hamburger menu? Bottom tab bar? Nothing yet — what's the target?
- **Search.** None today. Adding it changes the navbar. When does it land?
