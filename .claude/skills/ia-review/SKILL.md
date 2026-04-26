---
name: ia-review
description: Take a snapshot of the apps' information architecture (sitemap, navigation, audience-gating per route) and write or refresh `docs/information-architecture.md`. Use when the user wants to review the IA, plan a navigation/surface redesign, or check for drift since the last review.
license: MIT
metadata:
  author: trails.cool
  version: "1.0"
---

Walk the apps' route table + navigation surfaces, build a sitemap, surface
tensions and open questions, and capture the result in
`docs/information-architecture.md` (fresh write or refresh against the
prior snapshot).

The output is a *review document for the user* — not a unilateral plan.
Decisions are made by the user during the conversation that follows; the
doc captures the snapshot and the open questions that need answering.

---

## When to use

- The user explicitly asks for an IA review ("review the IA", "what's
  the information architecture look like").
- Before a navigation/surface redesign, so the redesign is informed by
  a current snapshot rather than a vibe.
- After a chunk of new features — pages, modals, settings sections —
  to check whether the IA is drifting (busy navbar, duplicated surfaces,
  orphaned routes).
- When the user says "we should do another IA review" after the prior
  doc has aged.

---

## Steps

1. **Detect mode (fresh vs refresh)**

   Check whether `docs/information-architecture.md` already exists.

   - **No file:** fresh review. Build the snapshot from scratch.
   - **File exists:** refresh review. Read it first; preserve the
     decisions/backlog the user has accumulated and only update the
     snapshot sections (sitemap, navigation, observations, open
     questions). Decisions previously crossed out stay crossed out.

   In refresh mode, also read the snapshot date at the top — anything
   shipped *since* that date is what your refresh should focus on.

2. **Identify the apps in scope**

   trails.cool ships two front-ends; the IA question lives mostly in
   the Journal:

   - `apps/journal/` — user accounts, social, content. Main IA
     surface.
   - `apps/planner/` — anonymous, ephemeral. ~5 routes; include for
     completeness but don't dwell.

   If the project structure has changed and there's a new app, include
   it.

3. **Read the route tables**

   For each app:

   ```
   apps/<app>/app/routes.ts
   ```

   This is the authoritative URL → route-file mapping. Both apps use
   explicit registration (per CLAUDE.md), so `routes.ts` is complete.

4. **Read the navigation surfaces**

   - `apps/journal/app/root.tsx` (and `apps/planner/app/root.tsx` if
     it has navigation) — the top navbar lives here. Read both the
     loader (to see what data the navbar consumes — counts, badges,
     user fields) and the `NavBar` component (to see what entries
     render).
   - `apps/journal/app/components/Footer.tsx` — the footer.
   - Any auth-gate / Terms-gate logic in the root loader.

5. **Sample key route loaders to understand audience**

   For each top-level route, scan its loader to determine:

   - Does it require a session? (loaders typically `redirect("/auth/login")`
     for anonymous visitors when so.)
   - Does it serve different content per session? (e.g., `home.tsx`
     branches on `user`.)
   - Does it have an access rule beyond auth? (locked-account 404s,
     visibility checks, etc.)

   You don't need to read every route — pick the top-level ones and
   any that look like they might gate differently than the URL hints.

6. **Build the sitemap**

   Group routes by audience: **Public surface** (anonymous-reachable)
   and **Authenticated surface** (signed-in only). Within each group,
   order by topic (auth, profile, content, settings, legal, etc.).

   Use plain code blocks with one URL per line and a one-line gloss
   per entry. Keep the format scannable; don't repeat what the URL
   already says.

7. **Map navigation surfaces**

   Two short tables/snippets:

   - **Navbar (signed-in)** — entries left-to-right.
   - **Navbar (signed-out)** — entries left-to-right.
   - **Footer** — links + any meta text.

   Note any entry whose visibility is conditional (badge counts, etc.).

8. **Identify "feed concepts" and other duplications**

   trails.cool has historically had multiple feed-like surfaces. Any
   IA review should ask: how many lists of activities are there? Is
   the same data reachable from multiple URLs? Is there a URL that
   shows different products to different audiences?

   Capture these in a small table or section if they exist.

9. **Map cross-app linking**

   Journal ↔ Planner cross-links (JWT callback URLs, "Try the
   Planner" buttons, etc.). One short list.

10. **List observations**

    Walk the snapshot and call out tensions worth discussing. Useful
    prompts:

    - **Busy clusters** — three or more controls for the same concept
      side-by-side in the navbar.
    - **Redundant paths** — same destination reachable from multiple
      surfaces with no clear reason.
    - **Dead-end routes** — pages reachable only by typing the URL,
      no in-app link.
    - **Missing surfaces** — common user need with no in-app path
      (e.g., "find people to follow" with no `/explore`).
    - **Audience mismatch** — same URL serving meaningfully different
      products to anon vs auth.
    - **Visual inconsistency** — adjacent navbar entries with
      different treatment (icon vs text, different baselines).
    - **Mobile hazards** — clusters that will wrap badly under
      small viewport widths.

    Each observation should be one short paragraph. Each is a
    question for the user to answer, not a decision you've made.

11. **List open IA questions**

    Distinct from observations: these are larger directional choices
    where the answer determines what other observations even matter.
    Examples: "Should `/` and `/feed` merge for signed-in users?",
    "Where does an `/explore` page live, if at all?", "Mobile
    pattern — hamburger? Bottom tab bar?"

    Keep these as bullets the user can answer in one line each.

12. **Write the doc**

    Output to `docs/information-architecture.md`. Use this top
    structure:

    ```markdown
    # Information Architecture Review

    *Snapshot date: YYYY-MM-DD.* If the navbar, route table, or feed
    model has shifted since then, treat this doc as stale and refresh
    against `apps/journal/app/routes.ts` + `apps/journal/app/root.tsx`.

    A snapshot of where every page lives, who sees it, and how visitors
    navigate between them. Intended for review — flag anything that
    doesn't make sense or should change.

    ## Apps
    [...]

    ## Journal sitemap
    ### Public surface (logged-out)
    [...]
    ### Authenticated surface (logged-in)
    [...]

    ### Navigation surfaces
    [...]

    ## Logged-in vs logged-out home
    [...if `/` does double duty...]

    ## [Any "N feed concepts" / duplication sections]
    [...]

    ## Cross-app linking
    [...]

    ## Planner sitemap
    [...short...]

    ## Observations worth discussing
    [...]

    ## Open IA questions
    [...]
    ```

    Use today's date for the snapshot. Reference the source-of-truth
    files at the top so the next review knows what to compare against.

13. **In refresh mode, preserve the user's accumulated decisions**

    The prior doc may already contain:

    - Resolved observations (struck through with a *Resolved: ...*
      note).
    - An "Implementation backlog" section with streams.
    - An "Open exploration" section.

    These are the *user's work*, not the snapshot. Carry them forward
    untouched unless one is plainly obsolete (e.g., the feature it
    references no longer exists). When in doubt, leave it and let the
    user prune.

    If a previously-flagged observation is no longer present in the
    current code (e.g., it was implemented), update its status note
    rather than removing it — preserves history.

14. **Surface a ranked next-action list**

    After writing the doc, summarize in 4–6 lines what changed since
    the prior review (or what the most actionable observations are if
    fresh). End with a question: which open IA question does the user
    want to tackle first?

    Don't start implementation work — this skill is for the
    *snapshot*. The decisions and the implementation backlog grow
    through the conversation that follows.

---

## What this skill is NOT

- **Not an implementation skill.** Don't write code, don't open PRs.
  The doc is the deliverable; decisions and code follow in normal
  conversation.
- **Not a unilateral redesign.** Observations are questions for the
  user. Don't bake "decisions" into the snapshot — those go in the
  backlog only when the user has actually answered the question.
- **Not a spec change.** OpenSpec specs describe what's shipped; this
  doc describes the IA *as it stands* with tensions flagged. Any
  resulting spec updates happen during implementation, not during the
  review.

---

## Guardrails

- Always include the snapshot date at the top of the output doc — IA
  drifts; future-you needs to know whether to trust the snapshot or
  refresh it.
- Reference the source-of-truth files (`routes.ts`, `root.tsx`) so the
  next review's diff is mechanical.
- Keep observations as questions, not decrees. The user makes the
  call.
- In refresh mode, preserve the user's accumulated decisions verbatim.
  Only the snapshot sections are yours to rewrite.
- Don't invent routes or features. If you can't find evidence for it
  in the code, don't put it in the snapshot.
- Keep it scannable. The doc is for review; verbose explanations bury
  the signal.
