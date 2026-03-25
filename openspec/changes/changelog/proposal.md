## Why

We ship features but nobody knows. There's no record of what changed, no way to
share progress, and no way for users to discover new features. A changelog
serves three audiences: existing users (what's new), potential users (the
project is alive and improving), and social followers (shareable updates).

## What Changes

- Add a `/changelog` page in the Journal showing dated entries with feature
  descriptions
- Changelog entries stored as markdown files in the repo (not a database) —
  low friction, version controlled, works with the PR workflow
- Each entry renders as a standalone shareable page (`/changelog/2026-03-25`)
  with Open Graph meta tags for social previews
- A "What's New" badge/dot on the nav bar when there are entries the user
  hasn't seen
- The changelog is public (no auth required) — it's part of the product's
  public face

## Capabilities

### New Capabilities

- `changelog`: Public changelog with dated entries, shareable individual pages with OG tags, "what's new" indicator

### Modified Capabilities

(None)

## Impact

- **Files**: New routes (`/changelog`, `/changelog/:slug`), markdown entry files
  in `docs/changelog/` or `apps/journal/changelog/`, nav bar update
- **Dependencies**: A markdown renderer (could reuse `react-markdown` or render
  at build time)
- **i18n**: Changelog entries written in English (primary audience), German
  later if needed
