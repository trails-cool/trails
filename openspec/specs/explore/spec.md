# explore Specification

## Purpose
Local user discovery for the Journal: a paginated directory of local users with `profile_visibility = 'public'`, plus a small "Active recently" surface, served at `/explore`. Closes the gap between "I want to follow someone on this instance" and "I have a username from outside the app." Federation of remote actor discovery is out of scope here and lives in `social-federation`.

## Requirements

### Requirement: Local user directory at `/explore`
The Journal SHALL expose a route at `/explore` that renders a paginated directory of local users with `profile_visibility = 'public'`. The directory SHALL be reachable to both signed-in users and anonymous visitors. Each row SHALL display the user's display name, handle (`@username`), follower count (accepted only — see `social-follows` spec), and a short truncated bio when present. For signed-in viewers each row SHALL also render a Follow / Requested / Unfollow button reflecting the viewer's current relationship to that user (using the same locked-account semantics as the profile page); for anonymous viewers the button SHALL NOT render.

#### Scenario: Signed-in user loads /explore
- **WHEN** a signed-in user requests `/explore`
- **THEN** the page renders a list of public local users with display name, handle, follower count, truncated bio, and a Follow / Requested / Unfollow button per row

#### Scenario: Anonymous visitor loads /explore
- **WHEN** an unauthenticated visitor requests `/explore`
- **THEN** the page renders the same list of public local users (display name, handle, follower count, truncated bio), but no Follow / Requested / Unfollow button is rendered on any row

#### Scenario: Truncated bio
- **WHEN** a user with a bio longer than 120 characters appears in the directory
- **THEN** the row shows the first 120 characters followed by an ellipsis

#### Scenario: User with no bio
- **WHEN** a user with no bio (`bio IS NULL` or empty string) appears in the directory
- **THEN** the row simply omits the bio area; the row remains valid

### Requirement: Directory is ordered by most-recent public activity
The directory SHALL be ordered by `MAX(activities.created_at) DESC` per user, considering only activities with `visibility = 'public'`. Users with no public activities SHALL sort to the end of the list, ordered among themselves by `users.created_at DESC` (newer registrations first). The ordering SHALL be deterministic — ties on the primary sort key SHALL be broken by `users.id` (descending) so pagination doesn't omit or duplicate rows.

#### Scenario: Active user appears before inactive user
- **WHEN** user A has a public activity from yesterday and user B has no public activities
- **THEN** A appears before B in the directory listing

#### Scenario: More-recently-active user appears first
- **WHEN** user A's most recent public activity is from today and user B's is from last week
- **THEN** A appears before B in the directory listing

#### Scenario: Tied recency falls back to user id
- **WHEN** users A and B share the same `MAX(activities.created_at)` (or both have no public activities)
- **THEN** the ordering between them is determined by `users.id` descending (deterministic), so neither is omitted nor duplicated when paginating

### Requirement: Excluded users
The directory SHALL exclude:

1. Users with `profile_visibility = 'private'` — they have explicitly opted out of public discovery (Mastodon-style locked accounts).
2. (Forward-compat) Users in any future banned/suspended state — when such a status column exists, it SHALL be added to the exclusion filter.

Excluded users SHALL NOT appear on `/explore` even if they have public activities and would otherwise sort to the top of the directory.

The demo persona (identified by `loadPersona().username`) is **not** excluded — its purpose is to give new users a follow target, so it appears in the directory like any other public user. The directory row SHALL render a "demo account" badge next to the display name so viewers know what they're following.

#### Scenario: Private profile is excluded from the directory
- **WHEN** user A has `profile_visibility = 'private'` and any activity history
- **THEN** A does not appear in the `/explore` directory regardless of which page is requested

#### Scenario: Demo persona appears with a demo badge
- **WHEN** the demo persona username (per `loadPersona()`) matches a row in the directory
- **THEN** the row is rendered like any other public user, with an additional small "demo account" badge next to the display name

#### Scenario: Public user with no activities is included
- **WHEN** user A has `profile_visibility = 'public'` but has never created an activity
- **THEN** A still appears in the directory (sorted toward the end by the recency rule)

### Requirement: "Active recently" sub-section
The `/explore` page SHALL render an "Active recently" sub-section at the top of the directory, listing up to N (default 5) public users who have created at least one public activity in the last 30 days, ordered by `MAX(activities.created_at) DESC`. The sub-section SHALL apply the same exclusion rules as the main directory (private profiles, future banned/suspended users — the demo persona is included like any other public user, with the same demo-badge treatment). When fewer than 1 user qualifies, the sub-section SHALL be omitted entirely (no empty header).

#### Scenario: Active-recently strip rendered with qualifying users
- **WHEN** at least one public local user (excluding private/demo) has a public activity within the last 30 days
- **THEN** the page renders the "Active recently" sub-section above the main directory, with up to 5 such users

#### Scenario: No qualifying users hides the strip
- **WHEN** no public local user (excluding private/demo) has any public activity within the last 30 days
- **THEN** the "Active recently" sub-section is not rendered at all; the main directory is the only listing on the page

#### Scenario: Strip excludes private profiles
- **WHEN** a private profile has a recent public activity
- **THEN** they are not included in the "Active recently" strip — the same private-profile exclusion as the main directory

#### Scenario: Strip includes the demo persona
- **WHEN** the demo persona has a recent public activity
- **THEN** it appears in the "Active recently" strip like any other public user, carrying the same demo-account badge as in the main directory

### Requirement: Pagination
The directory SHALL paginate via `?page=N` (1-indexed) and `?perPage=K` query parameters. Page size SHALL default to 20 per page and SHALL be capped at 100; `perPage` values outside `[1, 100]` SHALL be clamped to that range without raising an error. The response SHALL surface a "Next page" link when more rows exist past the current page, and a "Previous page" link when `page > 1`.

#### Scenario: Default pagination
- **WHEN** a visitor loads `/explore` with no query params
- **THEN** the page renders the first 20 users in the directory ordering

#### Scenario: Subsequent page
- **WHEN** a visitor loads `/explore?page=2`
- **THEN** the page renders rows 21–40 in the directory ordering, with a "Previous page" link to `?page=1` and (if more rows exist) a "Next page" link to `?page=3`

#### Scenario: Out-of-range perPage is clamped
- **WHEN** a visitor loads `/explore?perPage=10000` or `/explore?perPage=0`
- **THEN** the loader clamps `perPage` to `[1, 100]` and renders normally — no 400 response

#### Scenario: Page beyond the last
- **WHEN** a visitor loads `/explore?page=N` where N is past the last populated page
- **THEN** the response renders the empty list and a "Previous page" link; no 404

### Requirement: Navbar entry for signed-in users
The Journal navbar SHALL include an "Explore" entry for signed-in users, linking to `/explore`. Anonymous visitors SHALL NOT see this entry in the navbar — they reach `/explore` via the visitor home (see `journal-landing` spec). The visual treatment of the entry is governed by the navbar redesign (Stream C in `docs/information-architecture.md`); this requirement only mandates that the entry exists.

#### Scenario: Signed-in user sees the Explore entry
- **WHEN** a signed-in user loads any page
- **THEN** the navbar includes an "Explore" link to `/explore`

#### Scenario: Anonymous user does not see the Explore entry in the navbar
- **WHEN** an unauthenticated visitor loads any page
- **THEN** the navbar does not include an Explore entry; the visitor home provides the in-app path to `/explore` instead
