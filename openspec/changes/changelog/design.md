## Context

trails.cool ships features regularly but has no user-facing changelog. The
project philosophy values transparency and simplicity. We need a changelog
that's low-friction to write (just add a markdown file), works in-app, and
produces shareable social links.

## Goals / Non-Goals

**Goals:**
- Zero-friction authoring: drop a `.md` file, deploy, done
- Public page at `/changelog` listing all entries newest-first
- Individual entry pages at `/changelog/:slug` with OG meta for social sharing
- "What's New" indicator in nav for returning users
- Works without JavaScript (SSR)

**Non-Goals:**
- CMS or admin interface for writing entries
- RSS/Atom feed for subscribing to updates
- Email notifications for new entries
- Per-entry images or rich media (just markdown text)
- Bilingual entries (English only for now)

## Decisions

### D1: Markdown files in the repo, loaded at build time

Changelog entries live in `apps/journal/changelog/` as markdown files named
by date: `2026-03-25.md`. Vite's `import.meta.glob` loads them at build time.
No runtime file system access needed.

Each file has YAML frontmatter:

```yaml
---
title: "Collaborative route planning goes live"
date: 2026-03-25
---
```

### D2: Single route with dynamic slug

`/changelog` shows all entries. `/changelog/:date` shows a single entry.
Both are one route file using an optional param or two route files. The list
page shows titles + dates + first paragraph preview.

### D3: "What's New" via localStorage timestamp

Store `changelog:lastSeen` timestamp in localStorage. If the newest entry's
date is after this timestamp, show a dot on the nav "Changelog" link. Clicking
the changelog page updates the timestamp. No server state needed.

Users can permanently disable the "What's New" indicator by setting
`changelog:disabled` in localStorage. A "Don't show again" option is available
on the changelog page. When disabled, the dot never appears regardless of new
entries. The setting can be re-enabled from the changelog page itself via a
"Show new entry notifications" toggle. All client-side, no auth required.

### D4: Open Graph meta for social sharing

Each `/changelog/:date` page sets `og:title`, `og:description` (first
paragraph), and `og:url`. No og:image for now — text previews are fine.

### D5: RSS/Atom feed at `/changelog/feed.xml`

A standard Atom feed at `/changelog/feed.xml` so users and tools can subscribe.
Generated server-side from the same changelog entries used by the HTML pages.
Each `<entry>` includes the title, date, full markdown content rendered as HTML,
and a link to the individual changelog page.

The feed URL is advertised via a `<link rel="alternate" type="application/atom+xml">`
tag in the `<head>` of the changelog pages, so feed readers auto-discover it.

Atom over RSS 2.0 because Atom has a proper spec (RFC 4287), required dates,
and better content handling. All major feed readers support both.

## Risks / Trade-offs

- **Build-time loading means deploy to publish** → Acceptable. We deploy on
  every merge to main. Adding a changelog entry is: write file, PR, merge,
  deployed.
- **No rich media** → Keeps it simple. Can add images later if needed.
- **localStorage "what's new" doesn't sync across devices** → Fine for now.
  Server-side tracking would require auth and a DB table — overkill.
