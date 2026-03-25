## 1. Changelog Data Layer

- [ ] 1.1 Create `apps/journal/changelog/` directory with a sample entry (`2026-03-25.md`) covering the initial launch
- [ ] 1.2 Set up Vite `import.meta.glob` to load all `.md` files from the changelog directory with frontmatter parsing
- [ ] 1.3 Create `apps/journal/app/lib/changelog.server.ts` with functions: getAllEntries(), getEntry(date) returning parsed markdown + frontmatter

## 2. Routes

- [ ] 2.1 Add `/changelog` route showing all entries (date, title, preview) newest-first
- [ ] 2.2 Add `/changelog/:date` route rendering full markdown entry
- [ ] 2.3 Add Open Graph meta tags on entry pages (og:title, og:description, og:url)
- [ ] 2.4 Add both routes to `routes.ts`

## 3. What's New Indicator

- [ ] 3.1 Add "Changelog" link to Journal nav bar
- [ ] 3.2 Track `changelog:lastSeen` in localStorage, show dot when newest entry is newer
- [ ] 3.3 Clear indicator when user visits /changelog

## 4. Content

- [ ] 4.1 Write initial changelog entry for the launch (features shipped in Phase 1)
- [ ] 4.2 Add markdown rendering (react-markdown or built-in) for entry content

## 5. Verify

- [ ] 5.1 Verify /changelog lists entries correctly
- [ ] 5.2 Verify /changelog/:date renders full entry with OG tags
- [ ] 5.3 Verify "What's New" dot appears and dismisses
