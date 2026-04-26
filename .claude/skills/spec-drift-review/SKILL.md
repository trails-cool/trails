---
name: spec-drift-review
description: Walk every spec in `openspec/specs/`, compare it to the shipped code, and produce a categorized drift report (high/medium/low severity per spec, plus code-without-spec findings and structural suggestions). Use when the user wants to check spec drift, after a chunk of features has shipped, or when planning a spec catch-up PR.
license: MIT
metadata:
  author: trails.cool
  version: "1.0"
---

Walk the specs directory + the shipped code, compare them claim by
claim, and produce a structured drift report. The report is the
deliverable; fixes happen in a follow-up PR after the user has reviewed
the findings.

The goal is to keep `openspec/specs/` honest — specs are useless if they
don't describe the actual product, and worse than useless if they
contradict it.

---

## When to use

- The user explicitly asks to check spec drift ("are the specs in sync",
  "review specs against code").
- After a multi-feature chunk has shipped without per-feature spec
  promotion — drift accumulates fastest in catch-up phases.
- Before reorganizing the specs directory (split / merge / rename).
- When a spec contradicts the codebase and you're not sure which is
  right.

---

## Steps

1. **Get the lay of the land**

   Run these in parallel:

   ```bash
   ls openspec/specs/
   ls openspec/changes/           # in-flight work — NOT drift
   cat openspec/CAPABILITIES.md   # if it exists, it's the index
   openspec list --json           # any active changes that explain drift
   ```

   **Important:** any spec referenced in an active openspec change is
   *expected* to drift from current code — that drift is the work in
   progress. Note these and exclude them from the report.

2. **Identify the code-side anchors per spec**

   For each spec at `openspec/specs/<capability>/spec.md`, find the
   primary code locations that implement it. Most capability specs map
   to one or more of:

   - **Routes:** `apps/journal/app/routes/*.tsx` / `*.ts` —
     authoritative for URL behavior, redirects, access gating.
   - **Server lib:** `apps/journal/app/lib/<topic>.server.ts` — most
     business logic.
   - **Schema:** `packages/db/src/schema/journal.ts` — table shapes,
     visibility values, defaults, indexes.
   - **i18n:** `packages/i18n/src/locales/{en,de}.ts` — user-facing
     strings, often telling.
   - **Tests:** integration tests are a great oracle for the *intended*
     behavior; mismatch with the spec usually means the spec is stale.

   Don't read every file. Pick the 1–3 anchors per spec that the
   requirements most plausibly map to.

3. **Compare claim by claim**

   For each requirement in a spec, ask:

   - **Does the code do this?** If not, is it because the requirement
     was retired or because it was never shipped?
   - **Does the code do *more* than this?** New scenarios shipped
     without a spec update.
   - **Does the code do this *differently*?** Different URL,
     different default, different status code, different rule.
   - **Does this requirement reference a name that no longer exists?**
     Renamed routes, deleted helpers, removed tables.

   Track findings with severity:

   | Severity | What it means |
   |----------|---------------|
   | **High** | Spec actively misleads — claims a behavior the code does not exhibit. A reader implementing against the spec would write the wrong code. |
   | **Medium** | Spec is incomplete — code has scenarios the spec doesn't describe. Reader gets less information than they should but isn't actively misled. |
   | **Low** | Wording drift — comments/cross-refs mention a renamed thing, but the requirement statements are still accurate. |

4. **Find code-without-spec**

   Walk the route tree in `apps/journal/app/routes.ts` and the topic
   files in `apps/journal/app/lib/`. For each top-level concept ask:

   - Is this concept covered by a spec?
   - If yes, does the spec mention this surface?
   - If no, should it be?

   Genuine "no spec" cases are usually: new feature shipped without
   spec promotion, or piece of infrastructure deemed too internal for a
   spec. Both are valid; flag the former, leave the latter alone.

5. **Structural review**

   Spec organization itself can drift:

   - **Specs that grew too big** — multiple unrelated requirements
     under one spec. Candidates for a split (we previously split
     `account-settings` into `profile-settings`, `account-management`,
     `connected-services`).
   - **Specs that overlap** — the same requirement appears in two
     specs, or one spec keeps cross-referencing another. Candidate for
     a merge or a clearer ownership boundary.
   - **Specs that should exist but don't** — a capability is shipped
     and substantial enough to merit its own spec but is currently
     squeezed into another. (We added `sse-broker` and `notifications`
     this way.)
   - **`CAPABILITIES.md` drift** — if the index exists, check that
     every spec dir has an entry and every entry points at a real
     spec. The index is the easy thing to forget when adding a spec.

6. **Compose the report**

   Output to the conversation as a markdown structure. Don't write a
   doc unless the report is unusually large and the user asks for one —
   most drift reports get acted on inside a single PR and don't need a
   long-lived artifact.

   Suggested structure:

   ```markdown
   # Spec drift review — YYYY-MM-DD

   **Active changes excluded from this review:**
   - <name> (touches: <specs>)

   ## High-severity drift

   ### `<spec-name>`
   - **Requirement: <name>** says <X>; code at `<file:line>` does <Y>.
     [link / one-line action]
   - …

   ## Medium-severity drift

   ### `<spec-name>`
   - <description + code anchor>
   - …

   ## Low-severity drift (wording / cross-refs)

   - `<spec-name>`: <description>
   - …

   ## Code-without-spec

   - <feature> at `<file>` — should this be in <spec-name>, or a new
     spec? Recommendation: <…>

   ## Structural suggestions

   - Split: <spec-name> → <new-1>, <new-2>
   - Merge: <spec-a> + <spec-b> → <new>
   - New spec: <name> covering <area>
   - `CAPABILITIES.md` updates: <list>
   ```

7. **Propose next actions, then stop**

   End the review with three concrete options the user can pick from:

   - **Ship a catch-up PR for everything** — works when drift is
     mostly low/medium and the fix is mechanical.
   - **Fix high-severity first, defer the rest** — works when high
     items are urgent and the rest can wait for natural per-feature
     spec updates.
   - **Restructure first, then catch up** — works when structural
     suggestions (split / merge / new spec) are large enough that
     fixing claims inside the wrong spec shape would just have to be
     redone.

   Don't pick for them. Don't start fixing yet.

---

## What this skill is NOT

- **Not a fixer.** This skill produces a report. Apply happens after
  the user has decided which findings to act on.
- **Not a CI check.** It's interactive — judgment calls (severity,
  splits, merges) are part of the value, not an automation target.
- **Not for in-flight work.** Active openspec changes legitimately
  cause spec/code mismatch; flag them in the "excluded" section and
  move on.
- **Not a code review.** The question is "does the spec match the
  code", not "is the code good." Code-quality observations belong in
  PR review, not here.

---

## Guardrails

- Always start by reading active openspec changes — drift caused by
  in-flight work is not drift.
- Don't write spec edits during the review. The user picks which
  findings to act on; edits happen after.
- When code and spec disagree, the prevailing rule on this project is
  **code is source of truth** unless the user says otherwise. Surface
  the conflict; don't preemptively decide.
- Skip generated/scaffold files (e.g. `.react-router/types/**`) — they
  are derived, not product.
- Don't pad the report with low-severity wording drift unless the user
  asks for it. Concentrate signal.
- Keep observations specific (file + line + claim), not abstract. A
  finding without an anchor isn't actionable.
