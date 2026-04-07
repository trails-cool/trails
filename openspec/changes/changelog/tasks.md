## 1. Changelog Data Layer

- [x] 1.1 Create `apps/journal/changelog/` directory with a sample entry (`2026-03-25.md`) covering the initial launch
- [x] 1.2 Set up Vite `import.meta.glob` to load all `.md` files from the changelog directory with frontmatter parsing
- [x] 1.3 Create `apps/journal/app/lib/changelog.server.ts` with functions: getAllEntries(), getEntry(date) returning parsed markdown + frontmatter

## 2. Routes

- [x] 2.1 Add `/changelog` route showing all entries (date, title, preview) newest-first
- [x] 2.2 Add `/changelog/:date` route rendering full markdown entry
- [x] 2.3 Add Open Graph meta tags on entry pages (og:title, og:description, og:url)
- [x] 2.4 Add both routes to `routes.ts`

## 3. RSS/Atom Feed

- [x] 3.1 Add `/changelog/feed.xml` route that returns an Atom feed (application/atom+xml) with all entries
- [x] 3.2 Add `<link rel="alternate" type="application/atom+xml">` to changelog page heads for feed auto-discovery

## 4. What's New Indicator

- [x] 4.1 Add "Changelog" link to Journal nav bar
- [x] 4.2 Track `changelog:lastSeen` in localStorage, show dot when newest entry is newer
- [x] 4.3 Clear indicator when user visits /changelog
- [x] 4.4 Add "Don't show again" option on changelog page that sets `changelog:disabled` in localStorage
- [x] 4.5 Add "Show new entry notifications" toggle on changelog page to re-enable the indicator
- [x] 4.6 Skip indicator check when `changelog:disabled` is set

## 5. Content

- [x] 5.1 Write initial changelog entry for the launch (features shipped in Phase 1)
- [x] 5.2 Add markdown rendering (react-markdown or built-in) for entry content

## 6. Verify

- [x] 6.1 Verify /changelog lists entries correctly
- [x] 6.2 Verify /changelog/:date renders full entry with OG tags
- [x] 6.3 Verify "What's New" dot appears and dismisses
- [x] 6.6 Verify "Don't show again" disables indicator permanently
- [x] 6.7 Verify re-enabling notifications restores indicator behavior
- [x] 6.4 Verify /changelog/feed.xml returns valid Atom feed
- [x] 6.5 Verify feed auto-discovery link is present in page source
