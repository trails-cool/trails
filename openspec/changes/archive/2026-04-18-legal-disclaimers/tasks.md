## 1. Operator Information

- [x] 1.1 Decide what operator address to use on the Impressum (private address vs. business address service vs. lawyer's address) — legal requirement, must be reachable
- [x] 1.2 Create `apps/journal/app/lib/operator.ts` exporting the operator details (name, address, email, responsible person)

## 2. Legal Pages

- [x] 2.1 Create `apps/journal/app/routes/legal.imprint.tsx` rendering the Impressum from the operator config
- [x] 2.2 Create `apps/journal/app/routes/legal.terms.tsx` with Terms of Service covering alpha status, warranty disclaimer, DB reset disclosure, and data export responsibility
- [x] 2.3 Move existing `apps/journal/app/routes/privacy.tsx` to `apps/journal/app/routes/legal.privacy.tsx` and expand with GDPR-required sections (controller, legal basis, data subject rights, complaint right)
- [x] 2.4 Add a redirect from `/privacy` to `/legal/privacy` with 301 status
- [x] 2.5 Register the new routes in `apps/journal/app/routes.ts`

## 3. i18n

- [x] 3.1 Add German translations for all legal page copy (Impressum, Terms, Datenschutzerklärung) — DE is the authoritative version for German consumers
- [x] 3.2 Add English translations for the same pages
- [x] 3.3 Add translation keys for the alpha banner and signup acknowledgement checkbox

## 4. Signup Acknowledgement

- [x] 4.1 Add `terms_accepted_at` column (timestamp, nullable initially for existing users) to the `users` table in `packages/db/src/schema/journal.ts`
- [x] 4.2 Run `pnpm db:push` to apply the schema
- [x] 4.3 Add a required checkbox to `apps/journal/app/routes/auth.register.tsx` linking to the Terms
- [x] 4.4 Client-side: block form submission if checkbox is unchecked; show validation message
- [x] 4.5 Server-side: reject registration requests in `api.auth.register.ts` that don't include `termsAccepted: true`
- [x] 4.6 On successful registration, set `users.terms_accepted_at = NOW()`

## 5. Alpha Banner

- [x] 5.1 Create `apps/journal/app/components/AlphaBanner.tsx` — thin banner with message and dismiss button, reads `sessionStorage.alphaBannerDismissed`
- [x] 5.2 Render `<AlphaBanner />` in the Journal root layout
- [x] 5.3 Add corresponding i18n strings

## 6. Footer Links

- [x] 6.1 Create `apps/journal/app/components/Footer.tsx` with links to Impressum, Privacy, Terms
- [x] 6.2 Add the footer to the Journal root layout
- [x] 6.3 Add a footer to the Planner layout linking to the Journal's legal pages (absolute URLs, since Planner is stateless)

## 7. Review & Publish

- [x] 7.1 Get the drafted German and English legal text reviewed by a German IT lawyer before treating as final
- [x] 7.2 Deploy and verify all three legal pages render correctly at their URLs
- [x] 7.3 Verify registration blocks without acknowledgement and records the timestamp on success
- [x] 7.4 Verify the alpha banner appears and dismisses correctly
