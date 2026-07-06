## 1. Page

- [ ] 1.1 Create `apps/journal/app/routes/about.credits.tsx` with the three sections (typed entries array + i18n strings); register in `apps/journal/app/routes.ts`
- [ ] 1.2 Add en/de strings to `packages/i18n` (headings, per-entry acknowledgment lines, attribution wording)
- [ ] 1.3 Verify OSM attribution wording against the ODbL attribution guidelines; leave a commented GeoNames entry slot referencing `activity-locations`

## 2. Footer links

- [ ] 2.1 Add the Credits link to the journal `Footer.tsx`
- [ ] 2.2 Add the absolute-URL Credits link to the planner footer (same pattern as legal links)

## 3. Cross-references

- [ ] 3.1 Source acknowledgment lines from the credit lines in `docs/inspirations.md`; add mutual "update together" comments to the entries array, `docs/philosophy.md`, and `docs/inspirations.md`
- [ ] 3.2 Note the credits page as the target surface in the still-open `poi-index` and `activity-locations` attribution tasks

## 4. Verification

- [ ] 4.1 E2E: `/about/credits` renders unauthenticated with all six inspirations; footer link present on a journal page and a planner page
- [ ] 4.2 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
