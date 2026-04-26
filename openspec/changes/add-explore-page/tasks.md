## 1. Server-side directory query

- [ ] 1.1 Create `apps/journal/app/lib/explore.server.ts` with `listDirectory({ page, perPage })` returning `{ rows, totalCount }`. Rows include `id`, `username`, `displayName`, `bio`, `latestActivityAt` (nullable), and the user's `profileVisibility`. Filters: `profile_visibility = 'public'`, exclude demo persona, exclude future banned/suspended (placeholder filter — leave a TODO for when the column exists).
- [ ] 1.2 Order: `LEFT JOIN activities ON activities.owner_id = users.id AND activities.visibility = 'public'`, then `MAX(activities.created_at) DESC NULLS LAST`, tiebreaker `users.id DESC`.
- [ ] 1.3 Add `listActiveRecently(limit = 5)` returning the same row shape, filtered to users with at least one public activity in the last 30 days, capped at `limit`.
- [ ] 1.4 Add `countDirectory()` returning the total number of users that match the directory's filter, for pagination math.
- [ ] 1.5 Add a follower-count batch helper (`countFollowersBatch(userIds)`) so the page doesn't fan out N+1 queries — one query per page load.
- [ ] 1.6 Add `apps/journal/app/lib/explore.integration.test.ts` covering: public user appears, private user excluded, demo persona excluded, ordering by recency, tiebreaker by id, "Active recently" 30-day filter, "Active recently" cap.

## 2. Route + UI

- [ ] 2.1 Register `/explore` in `apps/journal/app/routes.ts`.
- [ ] 2.2 Create `apps/journal/app/routes/explore.tsx`:
  - Loader reads `?page=` (default 1) and `?perPage=` (default 20, clamp `[1, 100]`); fetches `listActiveRecently(5)`, `listDirectory({ page, perPage })`, `countDirectory()`, and (for signed-in viewers) per-row follow state via existing `getFollowState` batched.
  - Component renders the "Active recently" strip (if non-empty), then the main directory list, then "Previous" / "Next" links.
- [ ] 2.3 Reuse `<FollowButton>` for the per-row action; render only when the loader returns a signed-in viewer.
- [ ] 2.4 Bio truncation utility — first 120 characters + ellipsis, plain string slice (no markdown rendering yet).
- [ ] 2.5 Empty-state copy when the directory itself is empty (no public users at all).
- [ ] 2.6 Page-beyond-last empty state — render the empty list with a "Previous page" link, no 404.

## 3. Navbar + visitor home links

- [ ] 3.1 Add the "Explore" entry to the signed-in navbar in `apps/journal/app/root.tsx`, positioned alongside Feed / Routes / Activities. Visual treatment is plain for now; the navbar redesign (Stream C) refines it later.
- [ ] 3.2 Add a link to `/explore` on the visitor home (`apps/journal/app/routes/home.tsx`, signed-out branch) — secondary to the Register / Sign In CTAs but on the same fold. Wording: e.g. "Browse who's here →".
- [ ] 3.3 No new link on the signed-in home — the navbar entry covers it.

## 4. i18n

- [ ] 4.1 Add to `packages/i18n/src/locales/en.ts` and `de.ts`:
  - `explore.title`, `explore.heading`, `explore.empty`, `explore.activeRecently.heading`
  - `nav.explore`
  - `home.exploreLink` (visitor-home wording)
- [ ] 4.2 No i18n changes needed for FollowButton — it already uses the `social.*` keys.

## 5. Spec promotion + index

- [ ] 5.1 At archive time, promote `openspec/changes/add-explore-page/specs/explore/spec.md` to `openspec/specs/explore/spec.md` (no purpose section needed yet — the `## ADDED Requirements` content becomes the spec body).
- [ ] 5.2 At archive time, merge the `journal-landing` delta into `openspec/specs/journal-landing/spec.md`.
- [ ] 5.3 Add an entry for `explore` in `openspec/CAPABILITIES.md` under the Social section.

## 6. Tests

- [ ] 6.1 Integration tests for the directory query (covered in 1.6).
- [ ] 6.2 Add an e2e test in `e2e/explore.test.ts`:
  - Anonymous loads `/explore` and sees the directory but no Follow buttons.
  - Signed-in loads `/explore` and sees Follow buttons; clicking Follow on a public profile transitions the row to Unfollow without a hard reload.
  - A private profile does not appear in the directory regardless of which user is viewing.
- [ ] 6.3 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` before opening the PR.

## 7. PR + rollout

- [ ] 7.1 Open a PR with the change, link to `openspec/changes/add-explore-page/`, enable auto-merge.
- [ ] 7.2 After merge, archive the change (`/opsx:archive add-explore-page`) so the deltas promote into top-level specs.
- [ ] 7.3 Update `docs/information-architecture.md` to flip Stream F to ✅ Shipped and refresh the navbar diagram to include "Explore".
