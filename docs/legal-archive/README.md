# Legal archive

Frozen snapshots of the Terms of Service, Privacy Policy, and Impressum at
each version. Kept so we can always answer "what did the Terms / Privacy
text say on a given date" without digging through git blame.

## Why

- **Terms**: users accept a specific version at registration
  (`users.terms_accepted_at` + `users.terms_version`). The version string
  is the date in this folder — so there is always a file here matching
  every value that exists in that column.
- **Privacy**: users don't "accept" a privacy policy, but GDPR Art. 13/14
  requires us to tell users how their data is processed *at the time* it's
  processed. If a regulator or user asks what the policy said on
  YYYY-MM-DD, this folder answers.
- **Impressum**: less legally critical, but free to snapshot for symmetry.

## When to add a file

Whenever any of these three texts change materially, run the snapshot step
as part of the change:

1. Bump `TERMS_VERSION` / `PRIVACY_LAST_UPDATED` in
   [`apps/journal/app/lib/legal.ts`](../../apps/journal/app/lib/legal.ts)
   to today's date.
2. Re-render the affected page(s) into this folder as
   `<doc>-YYYY-MM-DD.md`.
3. Commit the bump **and** the new snapshot in the same PR.

A trivial wording tweak or typo fix does not need a new snapshot; only
changes that affect meaning / behaviour / purposes / third parties / legal
basis / retention / etc.

## File naming

`<doc>-YYYY-MM-DD.md` where `<doc>` is one of `terms`, `privacy`,
`imprint`, and the date matches the `Last updated` line in the
corresponding legal page on the day the snapshot was taken.

## How to render

The snapshots are plain markdown extracted from the TSX source by
stripping JSX tags / attributes and resolving the `operator.*`
placeholders. Same approach as the pbcopy export used during legal
reviews. One-liner (from repo root):

```bash
python3 scripts/render-legal.py <doc> > docs/legal-archive/<doc>-YYYY-MM-DD.md
```

(If `scripts/render-legal.py` doesn't exist yet, the extraction logic is
in the commit that seeded this directory — see PR history.)
